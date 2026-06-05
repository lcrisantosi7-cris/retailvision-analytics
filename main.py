"""
RetailVision Analytics — Backend
=================================
Arquitectura:
  • Un hilo de CAPTURA por cámara   → solo lee frames, sin bloqueos de inferencia
  • Un hilo de INFERENCIA por cámara → corre YOLOv8 sobre el frame más reciente
  • Endpoint MJPEG  /video/{cam_id}
  • WebSocket       /ws/monitor/{cam_id}
  • REST            /api/cameras  /api/historial/{cam_id}  /api/metricas/{cam_id}

Agregar una cámara nueva:
  1. Añade una entrada al diccionario CAMERAS (ver ejemplos comentados).
  2. "source" acepta:
       int          → índice de webcam local (0, 1, 2 …)
       str RTSP     → "rtsp://user:pass@IP:554/stream"
       str HTTP     → "http://IP:8080/video"
       str archivo  → "videos/grabacion.mp4"
  3. Las credenciales sensibles van en el archivo .env (nunca en este archivo).
"""

import asyncio
import base64
import os
import time
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from threading import Thread, Lock
from typing import Dict, List

from dotenv import load_dotenv
load_dotenv()   # carga variables desde .env si existe

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="RetailVision Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN DE CÁMARAS
# ══════════════════════════════════════════════════════════════════════════════
CAMERAS: Dict[str, dict] = {

    # ── Cámara 01 — webcam local ──────────────────────────────────────────────
    # Zonas calibradas para cámara en esquina superior (vista diagonal).
    # La cámara cubre el local completo en diagonal:
    #   - Parte izquierda del frame = zona de ropa/exhibición
    #   - Centro = zona de atención / mostrador
    #   - Parte derecha = probadores / fondo
    #   - Franja inferior = tránsito / entrada
    "cam_01": {
        "source": 0,
        "nombre": "Entrada principal",
        "zonas": {
            "Entrada":             (0.00, 0.75, 0.40, 1.00),   # franja inferior izquierda
            "Zona Ropa":           (0.00, 0.00, 0.38, 0.75),   # lado izquierdo (exhibición)
            "Zona Mostrador":      (0.38, 0.20, 0.70, 0.80),   # centro (atención)
            "Zona Probadores":     (0.70, 0.00, 1.00, 0.70),   # lado derecho (fondo/probadores)
            "Caja":                (0.40, 0.75, 1.00, 1.00),   # franja inferior derecha
        },
    },

    # ── Cámara 02 — EZVIZ CS-H6c (IP) ────────────────────────────────────────
    # Requisito previo: habilitar RTSP en la app EZVIZ
    #   App → Cámara → Ajustes → Configuración del servidor local → activar RTSP
    #   Desactivar "Cifrado de vídeo" si aparece esa opción.
    #
    # Credenciales:
    #   usuario      : admin  (fijo en EZVIZ)
    #   contraseña   : Verification Code — 6 letras mayúsculas de la etiqueta
    #                  en la parte inferior de la cámara.
    #                  Definir en .env como  CAM_02_PASS=XXXXXX
    #
    # Paths RTSP comunes para EZVIZ/Hikvision (probar en VLC primero):
    #   /H264?ch=1&subtype=0   → stream principal HD   ← activo
    #   /H264?ch=1&subtype=1   → sub-stream (menor resolución, más fluido)
    #   /h264_stream           → path alternativo
    #   /Streaming/Channels/101 → estilo Hikvision
    "cam_02": {
        "source": f"rtsp://admin:{os.getenv('CAM_02_PASS', '')}@192.168.0.106:554/H264?ch=1&subtype=0",
        "nombre": "Zona A - Ropa",
        "zonas": {
            "Zona A - Ropa":  (0.00, 0.00, 0.50, 1.00),
            "Zona A - Fondo": (0.50, 0.00, 1.00, 1.00),
        },
    },

    # ── Cámara 03 — ejemplo IP genérica ──────────────────────────────────────
    # "cam_03": {
    #     "source": f"rtsp://admin:{os.getenv('CAM_03_PASS', '')}@192.168.0.107:554/H264?ch=1&subtype=0",
    #     "nombre": "Zona B - Calzado",
    #     "zonas": {
    #         "Zona B - Calzado":  (0.00, 0.00, 0.50, 1.00),
    #         "Zona B - Fondo":    (0.50, 0.00, 1.00, 1.00),
    #     },
    # },

    # ── Cámara 04 — ejemplo IP genérica ──────────────────────────────────────
    # "cam_04": {
    #     "source": f"rtsp://admin:{os.getenv('CAM_04_PASS', '')}@192.168.0.108:554/H264?ch=1&subtype=0",
    #     "nombre": "Caja",
    #     "zonas": {
    #         "Caja": (0.00, 0.00, 1.00, 1.00),
    #     },
    # },
}

# ══════════════════════════════════════════════════════════════════════════════
# UTILIDADES
# ══════════════════════════════════════════════════════════════════════════════
# Paleta de colores para zonas (se reutiliza cíclicamente)
_PALETA = [
    (255, 200,   0),
    (  0, 200, 255),
    (  0, 255, 100),
    (200,   0, 255),
    (255,  80,  80),
    (255, 140,   0),
    ( 50, 205,  50),
    (  0, 191, 255),
]

def _colores_para_zonas(zonas: dict) -> dict:
    return {nombre: _PALETA[i % len(_PALETA)] for i, nombre in enumerate(zonas)}

def _zona_de_punto(cx: float, cy: float, zonas: dict) -> str:
    for nombre, (x1, y1, x2, y2) in zonas.items():
        if x1 <= cx <= x2 and y1 <= cy <= y2:
            return nombre
    return "Sin zona"

# ══════════════════════════════════════════════════════════════════════════════
# ESTADO GLOBAL POR CÁMARA
# ══════════════════════════════════════════════════════════════════════════════
HM_W, HM_H = 320, 240

def _estado_inicial(cam_id: str) -> dict:
    zonas = CAMERAS[cam_id]["zonas"]
    return {
        "cam_id":         cam_id,
        "nombre":         CAMERAS[cam_id]["nombre"],
        "total_clientes": 0,
        "clientes":       [],
        "conteo_zonas":   {z: 0 for z in zonas},
        "fps":            0.0,
        "timestamp":      "",
        "heatmap_b64":    "",
        "activa":         False,
    }

_estados:      Dict[str, dict]       = {cid: _estado_inicial(cid) for cid in CAMERAS}
_frames_jpeg:  Dict[str, bytes]      = {cid: b""   for cid in CAMERAS}
_frames_raw:   Dict[str, object]     = {cid: None  for cid in CAMERAS}
_heatmaps:     Dict[str, np.ndarray] = {cid: np.zeros((HM_H, HM_W), dtype=np.float32) for cid in CAMERAS}
_historial:    Dict[str, dict]       = {cid: defaultdict(list) for cid in CAMERAS}
_metricas:     Dict[str, dict]       = {cid: {"tp": 0, "fp": 0, "fn": 0, "frames": 0} for cid in CAMERAS}
_tiempos_zona: Dict[str, dict]       = {cid: defaultdict(list) for cid in CAMERAS}

_frame_locks: Dict[str, Lock] = {cid: Lock() for cid in CAMERAS}
_hm_locks:    Dict[str, Lock] = {cid: Lock() for cid in CAMERAS}

# ══════════════════════════════════════════════════════════════════════════════
# HEATMAP
# ══════════════════════════════════════════════════════════════════════════════
def _actualizar_heatmap(cam_id: str, cx: float, cy: float):
    px = int(np.clip(cx * HM_W, 5, HM_W - 6))
    py = int(np.clip(cy * HM_H, 5, HM_H - 6))
    cv2.circle(_heatmaps[cam_id], (px, py), 14, 6, -1)

def _render_heatmap_b64(cam_id: str) -> str:
    with _hm_locks[cam_id]:
        norm = cv2.normalize(_heatmaps[cam_id], None, 0, 255, cv2.NORM_MINMAX)
    colored = cv2.applyColorMap(norm.astype(np.uint8), cv2.COLORMAP_JET)
    _, buf = cv2.imencode(".png", colored)
    return base64.b64encode(buf).decode("utf-8")

# ══════════════════════════════════════════════════════════════════════════════
# HILO DE CAPTURA  (uno por cámara)
# Solo lee frames y los deposita en _frames_raw.
# Nunca bloquea esperando a YOLO — si la cámara se cae, reconecta sola.
# ══════════════════════════════════════════════════════════════════════════════
def capture_loop(cam_id: str):
    source = CAMERAS[cam_id]["source"]
    flags  = cv2.CAP_DSHOW if isinstance(source, int) else cv2.CAP_ANY

    while True:
        print(f"[CAP {cam_id}] Conectando a: {source}")
        cap = cv2.VideoCapture(source, flags)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not cap.isOpened():
            print(f"[CAP {cam_id}] No se pudo abrir la fuente. Reintentando en 5 s…")
            _estados[cam_id]["activa"] = False
            time.sleep(5)
            continue

        _estados[cam_id]["activa"] = True
        print(f"[CAP {cam_id}] Conectado correctamente.")

        for _ in range(4):   # vaciar buffer inicial
            cap.read()

        fail_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                fail_count += 1
                if fail_count >= 10:
                    print(f"[CAP {cam_id}] Demasiados fallos, reconectando…")
                    break
                time.sleep(0.1)
                continue
            fail_count = 0
            with _frame_locks[cam_id]:
                _frames_raw[cam_id] = frame

        cap.release()
        _estados[cam_id]["activa"] = False
        print(f"[CAP {cam_id}] Conexión perdida. Reintentando en 3 s…")
        time.sleep(3)

# ══════════════════════════════════════════════════════════════════════════════
# HILO DE INFERENCIA  (uno por cámara)
# Toma el frame más reciente, corre YOLOv8, actualiza estado y JPEG.
# ══════════════════════════════════════════════════════════════════════════════
def inference_loop(cam_id: str):
    from ultralytics import YOLO
    import torch

    zonas        = CAMERAS[cam_id]["zonas"]
    colores_zona = _colores_para_zonas(zonas)

    model  = YOLO("yolov8n.pt")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[INF {cam_id}] YOLO en dispositivo: {device}")
    model.to(device)

    t_prev    = time.time()
    t_heatmap = time.time()
    track_tiempos: dict = defaultdict(float)

    while _frames_raw[cam_id] is None:   # esperar primer frame
        time.sleep(0.05)

    while True:
        with _frame_locks[cam_id]:
            frame = _frames_raw[cam_id].copy() if _frames_raw[cam_id] is not None else None

        if frame is None:
            time.sleep(0.01)
            continue

        h, w = frame.shape[:2]

        # Reducir resolución de entrada a YOLO para mayor velocidad
        scale      = 640 / w if w > 640 else 1.0
        frame_yolo = cv2.resize(frame, (int(w * scale), int(h * scale))) if scale < 1.0 else frame

        results = model.track(frame_yolo, classes=[0], persist=True, verbose=False, imgsz=640)

        clientes     = []
        conteo_zonas = {z: 0 for z in zonas}
        _metricas[cam_id]["frames"] += 1

        if results[0].boxes is not None and results[0].boxes.id is not None:
            for box in results[0].boxes:
                x1y, y1y, x2y, y2y = box.xyxy[0].tolist()
                x1 = int(x1y / scale); y1 = int(y1y / scale)
                x2 = int(x2y / scale); y2 = int(y2y / scale)

                cx_norm  = ((x1 + x2) / 2) / w
                cy_norm  = ((y1 + y2) / 2) / h
                track_id = int(box.id[0])
                conf     = float(box.conf[0])

                zona = _zona_de_punto(cx_norm, cy_norm, zonas)
                if zona in conteo_zonas:
                    conteo_zonas[zona] += 1

                track_tiempos[track_id] += 1 / 25
                _actualizar_heatmap(cam_id, cx_norm, cy_norm)

                if conf >= 0.5:
                    _metricas[cam_id]["tp"] += 1
                else:
                    _metricas[cam_id]["fp"] += 1

                clientes.append({
                    "id":             track_id,
                    "zona":           zona,
                    "x":              round(cx_norm * 100, 1),
                    "y":              round(cy_norm * 100, 1),
                    "confianza":      round(conf, 2),
                    "tiempo_en_zona": round(track_tiempos[track_id]),
                })

                if zona in zonas:
                    _tiempos_zona[cam_id][zona].append(track_tiempos[track_id])

                color = colores_zona.get(zona, (200, 200, 200))
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, f"#{track_id} {conf:.0%}",
                            (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 2)
        else:
            if _estados[cam_id].get("total_clientes", 0) > 0:
                _metricas[cam_id]["fn"] += 1

        # Dibujar zonas
        for nombre, (zx1, zy1, zx2, zy2) in zonas.items():
            p1    = (int(zx1 * w), int(zy1 * h))
            p2    = (int(zx2 * w), int(zy2 * h))
            color = colores_zona[nombre]
            cv2.rectangle(frame, p1, p2, color, 1)
            cv2.putText(frame, nombre, (p1[0] + 4, p1[1] + 18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        # FPS
        t_now  = time.time()
        fps    = 1.0 / max(t_now - t_prev, 1e-6)
        t_prev = t_now
        cv2.putText(frame, f"FPS:{fps:.1f}  [{CAMERAS[cam_id]['nombre']}]  Clientes:{len(clientes)}",
                    (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        # Codificar JPEG para MJPEG stream (854×480, calidad 75)
        frame_web = cv2.resize(frame, (854, 480))
        _, buf = cv2.imencode(".jpg", frame_web, [cv2.IMWRITE_JPEG_QUALITY, 75])
        with _frame_locks[cam_id]:
            _frames_jpeg[cam_id] = buf.tobytes()
        # Heatmap: re-renderizar cada 2 s
        heatmap_b64 = _estados[cam_id].get("heatmap_b64", "")
        if t_now - t_heatmap >= 2.0:
            heatmap_b64 = _render_heatmap_b64(cam_id)
            t_heatmap   = t_now

        # Historial por hora
        hora = datetime.now().strftime("%H:00")
        _historial[cam_id][hora].append(len(clientes))

        # Actualizar estado
        _estados[cam_id].update({
            "total_clientes": len(clientes),
            "clientes":       clientes,
            "conteo_zonas":   conteo_zonas,
            "fps":            round(fps, 1),
            "timestamp":      datetime.now().isoformat(),
            "heatmap_b64":    heatmap_b64,
            "activa":         True,
        })

# ══════════════════════════════════════════════════════════════════════════════
# STARTUP
# ══════════════════════════════════════════════════════════════════════════════
@app.on_event("startup")
async def startup():
    for cam_id in CAMERAS:
        Thread(target=capture_loop,   args=(cam_id,), daemon=True, name=f"cap-{cam_id}").start()
        Thread(target=inference_loop, args=(cam_id,), daemon=True, name=f"inf-{cam_id}").start()
        print(f"[OK] Hilos iniciados para {cam_id} ({CAMERAS[cam_id]['nombre']})")

# ══════════════════════════════════════════════════════════════════════════════
# MJPEG STREAM
# ══════════════════════════════════════════════════════════════════════════════
def _mjpeg_generator(cam_id: str):
    """
    Genera el stream MJPEG con control de tasa adaptativo.
    Si el frame no cambió desde la última entrega, espera un poco más
    para no saturar la conexión con frames duplicados.
    """
    last_frame = b""
    while True:
        with _frame_locks[cam_id]:
            frame = _frames_jpeg[cam_id]

        if frame and frame != last_frame:
            last_frame = frame
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + frame +
                b"\r\n"
            )
            time.sleep(1 / 25)   # máximo 25 FPS al cliente
        else:
            time.sleep(1 / 60)   # frame sin cambios → espera corta sin bloquear

@app.get("/video/{cam_id}")
def video_feed(cam_id: str):
    if cam_id not in CAMERAS:
        raise HTTPException(status_code=404, detail=f"Cámara '{cam_id}' no encontrada")
    return StreamingResponse(
        _mjpeg_generator(cam_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )

# ══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET
# ══════════════════════════════════════════════════════════════════════════════
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = defaultdict(list)

    async def connect(self, cam_id: str, ws: WebSocket):
        await ws.accept()
        self.active[cam_id].append(ws)
        print(f"[WS] Cliente conectado a {cam_id}. Total: {len(self.active[cam_id])}")

    def disconnect(self, cam_id: str, ws: WebSocket):
        if ws in self.active[cam_id]:
            self.active[cam_id].remove(ws)

manager = ConnectionManager()

@app.websocket("/ws/monitor/{cam_id}")
async def ws_monitor(websocket: WebSocket, cam_id: str):
    if cam_id not in CAMERAS:
        await websocket.close(code=4004)
        return
    await manager.connect(cam_id, websocket)
    try:
        while True:
            await websocket.send_json(_estados[cam_id])
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        manager.disconnect(cam_id, websocket)
    except Exception as e:
        print(f"[WS {cam_id}] Error: {e}")
        manager.disconnect(cam_id, websocket)

# ══════════════════════════════════════════════════════════════════════════════
# REST API
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/")
def root():
    return {"status": "ok", "mensaje": "RetailVision Analytics API activa", "cameras": list(CAMERAS.keys())}

@app.get("/api/cameras")
def get_cameras():
    return {
        "cameras": [
            {
                "id":             cid,
                "nombre":         CAMERAS[cid]["nombre"],
                "activa":         _estados[cid]["activa"],
                "fps":            _estados[cid]["fps"],
                "total_clientes": _estados[cid]["total_clientes"],
            }
            for cid in CAMERAS
        ]
    }

@app.get("/api/historial/{cam_id}")
def get_historial(cam_id: str):
    if cam_id not in CAMERAS:
        raise HTTPException(404, f"Cámara '{cam_id}' no encontrada")
    data = [
        {"hora": h, "promedio": round(sum(v) / len(v), 1)}
        for h, v in sorted(_historial[cam_id].items())
    ]
    return {"cam_id": cam_id, "data": data}

@app.get("/api/zonas/{cam_id}")
def get_zonas(cam_id: str):
    if cam_id not in CAMERAS:
        raise HTTPException(404)
    return {"cam_id": cam_id, "zonas": list(CAMERAS[cam_id]["zonas"].keys())}

@app.get("/api/snapshot/{cam_id}")
def get_snapshot(cam_id: str):
    if cam_id not in CAMERAS:
        raise HTTPException(404)
    return {k: v for k, v in _estados[cam_id].items() if k != "heatmap_b64"}

@app.get("/api/metricas/{cam_id}")
def get_metricas(cam_id: str):
    if cam_id not in CAMERAS:
        raise HTTPException(404)
    m  = _metricas[cam_id]
    tp, fp, fn = m["tp"], m["fp"], m["fn"]
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1        = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    prom_zona = {
        zona: round(sum(t) / len(t), 1) if (t := _tiempos_zona[cam_id].get(zona, [])) else 0.0
        for zona in CAMERAS[cam_id]["zonas"]
    }
    return {
        "cam_id":               cam_id,
        "precision":            round(precision * 100, 1),
        "recall":               round(recall    * 100, 1),
        "f1":                   round(f1        * 100, 1),
        "tp": tp, "fp": fp, "fn": fn,
        "frames_procesados":    m["frames"],
        "tiempo_promedio_zona": prom_zona,
    }

# ── Endpoints legacy — apuntan siempre a la primera cámara ───────────────────
@app.get("/video")
def video_feed_legacy():
    return video_feed(next(iter(CAMERAS)))

@app.get("/api/historial")
def get_historial_legacy():
    return get_historial(next(iter(CAMERAS)))

@app.get("/api/zonas")
def get_zonas_legacy():
    return get_zonas(next(iter(CAMERAS)))

@app.get("/api/snapshot")
def get_snapshot_legacy():
    return get_snapshot(next(iter(CAMERAS)))

@app.get("/api/metricas")
def get_metricas_legacy():
    return get_metricas(next(iter(CAMERAS)))

# ══════════════════════════════════════════════════════════════════════════════
# MODO VIDEO — procesamiento de archivos subidos por el usuario
# ══════════════════════════════════════════════════════════════════════════════
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Trabajos activos: job_id → estado del procesamiento
_video_jobs: Dict[str, dict] = {}
_video_frames: Dict[str, bytes] = {}
_video_frame_locks: Dict[str, Lock] = {}

# Zonas para modo video (misma distribución que cam_01)
_ZONAS_VIDEO = {
    "Entrada":         (0.00, 0.75, 0.40, 1.00),
    "Zona Ropa":       (0.00, 0.00, 0.38, 0.75),
    "Zona Mostrador":  (0.38, 0.20, 0.70, 0.80),
    "Zona Probadores": (0.70, 0.00, 1.00, 0.70),
    "Caja":            (0.40, 0.75, 1.00, 1.00),
}


def _procesar_video(job_id: str, video_path: Path):
    """Hilo que procesa el video subido frame a frame con YOLOv8."""
    from ultralytics import YOLO
    import torch

    job = _video_jobs[job_id]
    job["estado"] = "procesando"

    colores_zona = _colores_para_zonas(_ZONAS_VIDEO)
    model  = YOLO("yolov8n.pt")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    print(f"[VIDEO {job_id}] Procesando '{video_path.name}' en {device}")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        job["estado"] = "error"
        job["error"]  = "No se pudo abrir el archivo de video"
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps_video    = cap.get(cv2.CAP_PROP_FPS) or 25
    job["total_frames"] = total_frames

    frame_count      = 0
    t_prev           = time.time()
    track_tiempos:   dict = defaultdict(float)
    historial_job:   dict = defaultdict(list)
    metricas_job     = {"tp": 0, "fp": 0, "fn": 0, "frames": 0}
    tiempos_zona_job: dict = defaultdict(list)
    max_clientes     = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        h, w = frame.shape[:2]

        scale      = 640 / w if w > 640 else 1.0
        frame_yolo = cv2.resize(frame, (int(w * scale), int(h * scale))) if scale < 1.0 else frame

        results = model.track(frame_yolo, classes=[0], persist=True, verbose=False, imgsz=640)

        clientes     = []
        conteo_zonas = {z: 0 for z in _ZONAS_VIDEO}
        metricas_job["frames"] += 1

        if results[0].boxes is not None and results[0].boxes.id is not None:
            for box in results[0].boxes:
                x1y, y1y, x2y, y2y = box.xyxy[0].tolist()
                x1 = int(x1y / scale); y1 = int(y1y / scale)
                x2 = int(x2y / scale); y2 = int(y2y / scale)

                cx_norm  = ((x1 + x2) / 2) / w
                cy_norm  = ((y1 + y2) / 2) / h
                track_id = int(box.id[0])
                conf     = float(box.conf[0])

                zona = _zona_de_punto(cx_norm, cy_norm, _ZONAS_VIDEO)
                if zona in conteo_zonas:
                    conteo_zonas[zona] += 1

                track_tiempos[track_id] += 1 / fps_video

                if conf >= 0.5:
                    metricas_job["tp"] += 1
                else:
                    metricas_job["fp"] += 1

                clientes.append({
                    "id":             track_id,
                    "zona":           zona,
                    "confianza":      round(conf, 2),
                    "tiempo_en_zona": round(track_tiempos[track_id]),
                })
                if zona in _ZONAS_VIDEO:
                    tiempos_zona_job[zona].append(track_tiempos[track_id])

                color = colores_zona.get(zona, (200, 200, 200))
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, f"#{track_id} {conf:.0%}",
                            (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 2)
        else:
            if len(clientes) > 0:
                metricas_job["fn"] += 1

        # Dibujar zonas
        for nombre, (zx1, zy1, zx2, zy2) in _ZONAS_VIDEO.items():
            p1    = (int(zx1 * w), int(zy1 * h))
            p2    = (int(zx2 * w), int(zy2 * h))
            color = colores_zona[nombre]
            cv2.rectangle(frame, p1, p2, color, 1)
            cv2.putText(frame, nombre, (p1[0] + 4, p1[1] + 18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        # Overlay de progreso
        t_now  = time.time()
        fps_r  = 1.0 / max(t_now - t_prev, 1e-6)
        t_prev = t_now
        pct    = int(frame_count / total_frames * 100) if total_frames > 0 else 0
        cv2.putText(frame, f"FPS:{fps_r:.1f}  Frame:{frame_count}/{total_frames}  Personas:{len(clientes)}  [{pct}%]",
                    (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        # Guardar frame JPEG para el stream
        frame_web = cv2.resize(frame, (854, 480))
        _, buf = cv2.imencode(".jpg", frame_web, [cv2.IMWRITE_JPEG_QUALITY, 75])
        with _video_frame_locks[job_id]:
            _video_frames[job_id] = buf.tobytes()

        # Historial por minuto del video
        seg     = frame_count / fps_video
        minuto  = f"{int(seg // 60):02d}:{int(seg % 60):02d}"
        historial_job[minuto].append(len(clientes))
        max_clientes = max(max_clientes, len(clientes))

        # Actualizar progreso en el estado
        job.update({
            "progreso":       pct,
            "frame_actual":   frame_count,
            "clientes_ahora": len(clientes),
            "conteo_zonas":   conteo_zonas,
        })

    cap.release()

    # Métricas finales
    tp, fp, fn = metricas_job["tp"], metricas_job["fp"], metricas_job["fn"]
    precision  = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall     = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1         = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    prom_zona = {
        zona: round(sum(t) / len(t), 1) if (t := tiempos_zona_job.get(zona, [])) else 0.0
        for zona in _ZONAS_VIDEO
    }
    historial_final = [
        {"tiempo": k, "promedio": round(sum(v) / len(v), 1)}
        for k, v in sorted(historial_job.items())
    ]

    job.update({
        "estado":       "completado",
        "progreso":     100,
        "metricas": {
            "precision":            round(precision * 100, 1),
            "recall":               round(recall    * 100, 1),
            "f1":                   round(f1        * 100, 1),
            "tp": tp, "fp": fp, "fn": fn,
            "frames_procesados":    metricas_job["frames"],
            "tiempo_promedio_zona": prom_zona,
        },
        "historial":    historial_final,
        "max_clientes": max_clientes,
    })
    print(f"[VIDEO {job_id}] Completado. Frames: {frame_count}, Personas máx: {max_clientes}")

    # Limpiar archivo temporal
    try:
        video_path.unlink()
    except Exception:
        pass


def _mjpeg_video_generator(job_id: str):
    last_frame = b""
    while True:
        job = _video_jobs.get(job_id)
        if not job:
            break
        with _video_frame_locks.get(job_id, Lock()):
            frame = _video_frames.get(job_id, b"")

        if frame and frame != last_frame:
            last_frame = frame
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + frame +
                b"\r\n"
            )
            time.sleep(1 / 25)
        else:
            if job.get("estado") == "completado":
                break
            time.sleep(1 / 60)


@app.post("/api/upload-video")
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Sube un archivo de video y lo procesa con YOLOv8 en segundo plano."""
    ext = Path(file.filename).suffix.lower()
    if ext not in {".mp4", ".avi", ".mov", ".mkv", ".webm"}:
        raise HTTPException(400, "Formato no soportado. Usa MP4, AVI, MOV, MKV o WEBM.")

    job_id    = str(uuid.uuid4())[:8]
    save_path = UPLOAD_DIR / f"{job_id}{ext}"

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    _video_jobs[job_id]        = {
        "estado":          "en_cola",
        "progreso":        0,
        "frame_actual":    0,
        "total_frames":    0,
        "clientes_ahora":  0,
        "conteo_zonas":    {},
        "metricas":        None,
        "historial":       [],
        "max_clientes":    0,
        "nombre_archivo":  file.filename,
    }
    _video_frames[job_id]      = b""
    _video_frame_locks[job_id] = Lock()

    Thread(target=_procesar_video, args=(job_id, save_path), daemon=True, name=f"video-{job_id}").start()

    return {"job_id": job_id, "mensaje": "Procesamiento iniciado"}


@app.get("/api/video-status/{job_id}")
def get_video_status(job_id: str):
    if job_id not in _video_jobs:
        raise HTTPException(404, "Trabajo no encontrado")
    return _video_jobs[job_id]


@app.get("/video/upload/{job_id}")
def video_upload_feed(job_id: str):
    if job_id not in _video_jobs:
        raise HTTPException(404, "Trabajo no encontrado")
    return StreamingResponse(
        _mjpeg_video_generator(job_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.delete("/api/upload-video/{job_id}")
def delete_video_job(job_id: str):
    _video_jobs.pop(job_id, None)
    _video_frames.pop(job_id, None)
    _video_frame_locks.pop(job_id, None)
    return {"ok": True}
