# RetailVision Analytics

Sistema de monitoreo de clientes en tiempo real usando YOLOv8 y visión artificial. Detecta y rastrea personas por zonas del local desde una o varias cámaras.

**RetailMonitor · Plataforma de análisis inteligente**

---

## Capturas

### 🖥️ Monitor — Feed en vivo + KPIs

Feed de cámara con bounding boxes, KPIs en tiempo real, distribución por zonas y mapa de calor acumulado.

![Monitor-Dashboard](Screenshots/Dashboard.webp)

### 📊 Análisis — Métricas del modelo

Precisión, Recall y F1-Score con anillos animados, conteo TP/FP/FN, historial de flujo por hora y permanencia promedio por zona.

![Analisis-Medidas](Screenshots/Analisis.webp)

### 📄 Reportes — Tabla por zona

Distribución de clientes por zona, porcentaje de participación, permanencia promedio y nivel de prioridad.

![Reporte-Tabla](Screenshots/reporte.webp)

### 📄 Reportes — Recomendaciones automáticas

Sugerencias generadas por el sistema a partir del comportamiento detectado durante la sesión.

![Reporte-Recomendaciones](Screenshots/reporte_recomendaciones.webp)

### 📹 Video — Análisis de archivo

Vista Video con el video procesado + métricas debajo

![Video-Analisis](Screenshots/video_analisis.webp)

### 📷 Monitor — Selector multi-cámara

Vista Monitor con el selector de cámara visible (cuando tengas las dos activas)

![Multi-Camara](Screenshots/multi_camara.webp)

---

## Requisitos

- Python 3.10+
- Node.js 18+
- Cámara web o cámara IP con RTSP

---

## Instalación

### 1. Clonar

```bash
git clone https://github.com/lcrisantosi7-cris/retailvision-analytics
cd retailvision-analytics
```

### 2. Entorno virtual

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

> Windows — si PowerShell bloquea la activación:
>
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

### 3. Dependencias Python

**Si tienes GPU NVIDIA — hacer esto PRIMERO (mucho más rápido):**

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

**Luego (o directamente si no tienes GPU):**

```bash
pip install -r requirements.txt
```

> Linux sin entorno gráfico:
>
> ```bash
> sudo apt-get install libgl1-mesa-glx libglib2.0-0
> pip install -r requirements.txt
> ```

### 4. Dependencias frontend

```bash
cd frontend
npm install
cd ..
```

---

## Configuración de cámaras

Edita el diccionario `CAMERAS` en `main.py`:

```python
# Webcam local
"cam_01": {
    "source": 0,          # 0 = primera cámara, 1 = segunda...
    "nombre": "Entrada",
    "zonas": { ... },
},

# Cámara IP (RTSP)
"cam_02": {
    "source": f"rtsp://admin:{os.getenv('CAM_02_PASS', '')}@192.168.0.x:554/H264?ch=1&subtype=0",
    "nombre": "Zona A",
    "zonas": { ... },
},
```

Las contraseñas van en `.env` (ya está en `.gitignore`):

```
CAM_02_PASS=XXXXXX
```

**Cámaras EZVIZ:** habilitar RTSP primero en la app → Cámara → ⚙ → Configuración del servidor local → activar RTSP.

---

## Ejecución

**Backend** (con el entorno virtual activado):

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend** (segunda terminal):

```bash
cd frontend
npm run dev
```

Abrir: **http://localhost:5173**

> La primera vez, YOLOv8 descarga automáticamente `yolov8n.pt` (~6 MB). Necesitas internet.

---

## Vistas

| Vista        | Descripción                                                      |
| ------------ | ---------------------------------------------------------------- |
| **Monitor**  | Feed en vivo, KPIs, zonas, heatmap y lista de clientes           |
| **Análisis** | Precisión, Recall, F1, historial por hora y permanencia por zona |
| **Reportes** | Reporte ejecutivo exportable a PDF                               |
| **📹 Video** | Sube un video MP4/AVI/MOV y analízalo con YOLOv8                 |

---

## API

| Ruta                             | Descripción                   |
| -------------------------------- | ----------------------------- |
| `GET /api/cameras`               | Lista de cámaras y su estado  |
| `GET /video/{cam_id}`            | Stream MJPEG                  |
| `WS /ws/monitor/{cam_id}`        | Datos en tiempo real          |
| `GET /api/metricas/{cam_id}`     | Precisión, Recall, F1         |
| `GET /api/historial/{cam_id}`    | Promedio de clientes por hora |
| `POST /api/upload-video`         | Subir video para análisis     |
| `GET /api/video-status/{job_id}` | Estado del procesamiento      |

Documentación interactiva: **http://localhost:8000/docs**

---

## Solución de problemas

**Cámara no abre** — cambia `"source": 0` a `1` o `2`. Si otra app usa la cámara (Zoom, Teams), ciérrala primero.

**Cámara IP no conecta** — verifica la URL en VLC antes de usar el backend: `Medio → Abrir ubicación de red`.

**Video lento** — instala PyTorch con CUDA si tienes GPU NVIDIA (ver paso 3). Sin GPU es normal ver menos FPS en CPU.

**`opencv-python` falla en Linux** — instala `libgl1-mesa-glx libglib2.0-0` antes.

**"Desconectado" en el frontend** — verifica que el backend esté corriendo en el puerto 8000.

---

## Stack

**Backend:** FastAPI · YOLOv8 (Ultralytics) · OpenCV · Uvicorn · python-dotenv

**Frontend:** React 19 · Vite · Recharts · jsPDF · html2canvas

---

_`venv/`, `node_modules/` y `.env` están en `.gitignore` — cada colaborador ejecuta la instalación localmente._

---

_RetailMonitor · Plataforma de análisis inteligente_


## Configuración por variables de entorno

Copia `.env.example` a `.env` y ajusta los valores. `CAM_01_SOURCE` acepta `0`, `1`, etc. para webcams locales, o una URL RTSP/HTTP para cámaras de red. La segunda cámara solo se activa cuando defines `CAM_02_SOURCE`; así el servidor no intenta conectarse a una IP privada de ejemplo.

`CORS_ORIGINS` admite una lista separada por comas. En producción debe contener únicamente el dominio real del frontend. `MAX_UPLOAD_MB` limita el tamaño de los videos subidos y `VITE_API_BASE_URL` indica al frontend dónde encontrar la API pública.

## Docker Compose

Requisitos: Docker y Docker Compose.

```bash
cp .env.example .env
# edita .env
docker compose up --build
```

Abre `http://localhost:5173` y comprueba la API en `http://localhost:8000/health`. El primer arranque descarga el modelo `yolov8n.pt` y lo conserva en el volumen `yolo-cache`.

## Despliegue recomendado

Para una instalación real con cámaras RTSP recomiendo un VPS Linux con Docker, como Hetzner Cloud, DigitalOcean o una VM de AWS. El VPS debe poder alcanzar las cámaras por red; un servicio PaaS no puede ver una webcam conectada a tu laptop ni una cámara detrás de una red privada sin VPN o túnel. En el VPS instala Docker, clona el repositorio, configura `.env`, ejecuta `docker compose up -d --build` y coloca HTTPS delante con Caddy o Nginx.

Para una demo sin cámaras en vivo, puedes desplegar el backend Docker como Web Service en Render o Railway y el frontend como sitio estático en Vercel. Configura `VITE_API_BASE_URL` con la URL pública del backend y `CORS_ORIGINS` con la URL del frontend. La API usa WebSocket y streaming MJPEG, por lo que debes contratar/configurar un servicio que soporte conexiones persistentes; no conviene desplegar este backend como función serverless.

## Comprobaciones

```bash
python -m py_compile main.py
cd frontend
npm ci
npm run lint
npm run build
```


## Demo rápida con Render + Vercel

Esta modalidad analiza un video subido desde la interfaz. En Render se configura `ENABLE_LIVE_CAMERAS=false` porque Render no puede acceder a la webcam de tu computadora. El archivo local dentro de `uploads/` no se publica automáticamente: debes subirlo desde la pantalla **Video** después de desplegar.

1. En Render crea un **Web Service** conectado a este repositorio. Selecciona Docker y usa `Dockerfile.backend`, o crea el servicio desde `render.yaml` con **New → Blueprint**.
2. Configura estas variables en Render: `ENABLE_LIVE_CAMERAS=false`, `CORS_ORIGINS=https://TU-PROYECTO.vercel.app`, `MAX_UPLOAD_MB=500`.
3. Espera el despliegue y abre `https://TU-SERVICIO.onrender.com/health`. Debe responder con `status: ok`. Copia la URL del servicio.
4. En Vercel importa el mismo repositorio y establece **Root Directory** como `frontend`. El framework debe ser Vite, el comando de build `npm run build` y el directorio de salida `dist`.
5. En Vercel crea `VITE_API_BASE_URL=https://TU-SERVICIO.onrender.com`, vuelve a desplegar y copia la URL del frontend.
6. Regresa a Render y reemplaza `CORS_ORIGINS` por la URL final de Vercel. Guarda y vuelve a desplegar el backend.
7. Entra al frontend, selecciona **Video**, pulsa para subir el archivo ubicado en tu carpeta local `uploads/`, espera el procesamiento y muestra el stream y las métricas.

Si Render se duerme en el plan gratuito, la primera petición puede tardar. Abre `/health` antes de la demo y espera a que responda. Para una presentación estable conviene usar un plan que mantenga el servicio activo.
