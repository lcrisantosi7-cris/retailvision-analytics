import asyncio
import base64
import time
from collections import defaultdict
from datetime import datetime
from threading import Thread, Lock
from typing import List

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="Retail Monitor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Configuración de cámara ───────────────────────────────────────────────────
# Cambia CAMERA_INDEX si tienes varias cámaras:
#   0 = primera cámara disponible (webcam integrada o única USB)
#   1 = segunda cámara (USB externa si hay webcam integrada)
# En una PC de escritorio sin webcam integrada, la cámara USB suele ser 0.
CAMERA_INDEX = 0

# ── Zonas del local (coordenadas normalizadas 0-1) ────────────────────────────
ZONAS = {
    "Entrada":             (0.00, 0.00, 0.20, 1.00),
    "Zona A - Ropa":       (0.20, 0.00, 0.45, 0.50),
    "Zona B - Calzado":    (0.20, 0.50, 0.45, 1.00),
    "Zona C - Accesorios": (0.45, 0.00, 0.75, 1.00),
    "Caja":                (0.75, 0.00, 1.00, 1.00),
}
COLORES_ZONA = {
    "Entrada":             (255, 200,   0),
    "Zona A - Ropa":       (  0, 200, 255),
    "Zona B - Calzado":    (  0, 255, 100),
    "Zona C - Accesorios": (200,   0, 255),
    "Caja":                (255,  80,  80),
}

def zona_de_punto(cx_norm: float, cy_norm: float) -> str:
    for nombre, (x1, y1, x2, y2) in ZONAS.items():
        if x1 <= cx_norm <= x2 and y1 <= cy_norm <= y2:
            return nombre
    return "Sin zona"

# ── Heatmap acumulado ─────────────────────────────────────────────────────────
HM_W, HM_H = 320, 240
heatmap_acum = np.zeros((HM_H, HM_W), dtype=np.float32)
_heatmap_lock = Lock()

def actualizar_heatmap(cx_norm: float, cy_norm: float):
    px = int(np.clip(cx_norm * HM_W, 5, HM_W - 6))
    py = int(np.clip(cy_norm * HM_H, 5, HM_H - 6))
    cv2.circle(heatmap_acum, (px, py), 14, 6, -1)

def render_heatmap_b64() -> str:
    with _heatmap_lock:
        norm = cv2.normalize(heatmap_acum, None, 0, 255, cv2.NORM_MINMAX)
    colored = cv2.applyColorMap(norm.astype(np.uint8), cv2.COLORMAP_JET)
    _, buf = cv2.imencode(".png", colored)
    return base64.b64encode(buf).decode("utf-8")

# ── Estado global ─────────────────────────────────────────────────────────────
# frame_b64 ya NO va en el estado — el video tiene su propio endpoint MJPEG
estado: dict = {
    "total_clientes": 0,
    "clientes": [],
    "conteo_zonas": {z: 0 for z in ZONAS},
    "fps": 0.0,
    "timestamp": "",
    "heatmap_b64": "",   # se actualiza cada 2 segundos, no cada frame
}
historial_por_hora: dict = defaultdict(list)

metricas_acum: dict = {
    "tp": 0,
    "fp": 0,
    "fn": 0,
    "frames": 0,
}
tiempos_por_zona: dict = defaultdict(list)

# ── Buffer del frame más reciente para MJPEG ──────────────────────────────────
_frame_lock  = Lock()
_frame_jpeg  = b""          # bytes JPEG del último frame procesado
_frame_raw   = None         # frame sin anotaciones (para MJPEG fluido)

# ── Hilo de cámara ────────────────────────────────────────────────────────────
def camera_loop():
    global estado, heatmap_acum, _frame_jpeg, _frame_raw

    from ultralytics import YOLO
    import torch

    model  = YOLO("yolov8n.pt")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[YOLO] Usando dispositivo: {device}")
    model.to(device)

    # CAP_DSHOW acelera la apertura en Windows; en Linux/Mac se ignora
    cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT,  720)
    # Reducir el buffer interno de OpenCV → menos latencia
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        print(f"[ERROR] No se pudo abrir la cámara (índice {CAMERA_INDEX}).")
        print("        Prueba cambiando CAMERA_INDEX a 1 o 2 si tienes varias cámaras.")
        return
    print(f"[OK] Cámara {CAMERA_INDEX} iniciada.")

    t_prev        = time.time()
    t_heatmap     = time.time()   # control para actualizar heatmap cada 2 s
    track_tiempos: dict = defaultdict(float)

    # Saltar frames acumulados en el buffer al arrancar
    for _ in range(3):
        cap.read()

    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.02)
            continue

        h, w = frame.shape[:2]

        # ── Inferencia YOLO ──────────────────────────────────────────────────
        results = model.track(frame, classes=[0], persist=True, verbose=False)

        clientes     = []
        conteo_zonas = {z: 0 for z in ZONAS}
        metricas_acum["frames"] += 1

        if results[0].boxes is not None and results[0].boxes.id is not None:
            for box in results[0].boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                cx_norm = ((x1 + x2) / 2) / w
                cy_norm = ((y1 + y2) / 2) / h
                track_id = int(box.id[0])
                conf     = float(box.conf[0])

                zona = zona_de_punto(cx_norm, cy_norm)
                if zona in conteo_zonas:
                    conteo_zonas[zona] += 1

                track_tiempos[track_id] += 1 / 25
                actualizar_heatmap(cx_norm, cy_norm)

                if conf >= 0.5:
                    metricas_acum["tp"] += 1
                else:
                    metricas_acum["fp"] += 1

                clientes.append({
                    "id":           track_id,
                    "zona":         zona,
                    "x":            round(cx_norm * 100, 1),
                    "y":            round(cy_norm * 100, 1),
                    "confianza":    round(conf, 2),
                    "tiempo_en_zona": round(track_tiempos[track_id]),
                })

                if zona in ZONAS:
                    tiempos_por_zona[zona].append(track_tiempos[track_id])

                # Bounding box sobre el frame
                color = COLORES_ZONA.get(zona, (200, 200, 200))
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, f"#{track_id} {conf:.0%}",
                            (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX,
                            0.45, color, 2)
        else:
            if estado.get("total_clientes", 0) > 0:
                metricas_acum["fn"] += 1

        # ── Dibujar zonas ────────────────────────────────────────────────────
        for nombre, (zx1, zy1, zx2, zy2) in ZONAS.items():
            p1    = (int(zx1 * w), int(zy1 * h))
            p2    = (int(zx2 * w), int(zy2 * h))
            color = COLORES_ZONA[nombre]
            cv2.rectangle(frame, p1, p2, color, 1)
            cv2.putText(frame, nombre, (p1[0] + 4, p1[1] + 18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        # ── FPS ──────────────────────────────────────────────────────────────
        t_now = time.time()
        fps   = 1.0 / max(t_now - t_prev, 1e-6)
        t_prev = t_now
        cv2.putText(frame, f"FPS: {fps:.1f}  Clientes: {len(clientes)}",
                    (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)

        # ── Codificar frame → JPEG (para MJPEG) ──────────────────────────────
        # Resolución reducida para el stream web: 854x480 es suficiente
        frame_web = cv2.resize(frame, (854, 480))
        _, buf = cv2.imencode(
            ".jpg", frame_web,
            [cv2.IMWRITE_JPEG_QUALITY, 80]   # 80 = buen balance calidad/velocidad
        )
        with _frame_lock:
            _frame_jpeg = buf.tobytes()

        # ── Heatmap: re-renderizar solo cada 2 segundos ───────────────────────
        heatmap_b64 = estado.get("heatmap_b64", "")
        if t_now - t_heatmap >= 2.0:
            heatmap_b64  = render_heatmap_b64()
            t_heatmap    = t_now

        # ── Historial por hora ────────────────────────────────────────────────
        hora = datetime.now().strftime("%H:00")
        historial_por_hora[hora].append(len(clientes))

        # ── Actualizar estado (sin frame_b64) ─────────────────────────────────
        estado.update({
            "total_clientes": len(clientes),
            "clientes":       clientes,
            "conteo_zonas":   conteo_zonas,
            "fps":            round(fps, 1),
            "timestamp":      datetime.now().isoformat(),
            "heatmap_b64":    heatmap_b64,
        })

    cap.release()


@app.on_event("startup")
async def startup():
    t = Thread(target=camera_loop, daemon=True)
    t.start()
    print("[OK] Hilo de cámara y YOLO iniciado.")


# ── MJPEG stream ──────────────────────────────────────────────────────────────
def _mjpeg_generator():
    """Genera un stream MJPEG continuo desde el buffer del hilo de cámara."""
    while True:
        with _frame_lock:
            frame = _frame_jpeg

        if frame:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + frame +
                b"\r\n"
            )
        # ~30 FPS máximo en el stream web
        time.sleep(1 / 30)


@app.get("/video")
def video_feed():
    """Endpoint MJPEG — úsalo como src de un <img> en el frontend."""
    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ── WebSocket Manager ─────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        print(f"[WS] Cliente conectado. Total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

manager = ConnectionManager()


@app.websocket("/ws/monitor")
async def ws_monitor(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Solo datos JSON — sin frame_b64, mucho más liviano
            await websocket.send_json(estado)
            await asyncio.sleep(0.5)   # 2 actualizaciones por segundo para los datos
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WS] Error: {e}")
        manager.disconnect(websocket)


# ── REST ──────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "mensaje": "Retail Monitor API activa"}

@app.get("/api/historial")
def get_historial():
    data = [
        {"hora": h, "promedio": round(sum(v) / len(v), 1)}
        for h, v in sorted(historial_por_hora.items())
    ]
    return {"data": data}

@app.get("/api/zonas")
def get_zonas():
    return {"zonas": list(ZONAS.keys())}

@app.get("/api/snapshot")
def get_snapshot():
    """Estado actual sin imágenes (para debug rápido y reporte)."""
    return {k: v for k, v in estado.items() if k != "heatmap_b64"}

@app.get("/api/metricas")
def get_metricas():
    """Métricas de evaluación del modelo + tiempo promedio por zona."""
    tp = metricas_acum["tp"]
    fp = metricas_acum["fp"]
    fn = metricas_acum["fn"]

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1        = (2 * precision * recall / (precision + recall)
                 if (precision + recall) > 0 else 0.0)

    prom_zona = {}
    for zona in ZONAS:
        tiempos = tiempos_por_zona.get(zona, [])
        prom_zona[zona] = round(sum(tiempos) / len(tiempos), 1) if tiempos else 0.0

    return {
        "precision":            round(precision * 100, 1),
        "recall":               round(recall    * 100, 1),
        "f1":                   round(f1        * 100, 1),
        "tp": tp, "fp": fp, "fn": fn,
        "frames_procesados":    metricas_acum["frames"],
        "tiempo_promedio_zona": prom_zona,
    }
