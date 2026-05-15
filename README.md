# RetailMonitor

Sistema inteligente de monitoreo y análisis de comportamiento de clientes en establecimientos comerciales, desarrollado con visión artificial (YOLOv8) y una interfaz web en tiempo real.

Proyecto de investigación aplicada — Universidad César Vallejo · Piura 2026.

---

## ¿Qué hace el sistema?

RetailMonitor conecta una cámara al local comercial y, usando el modelo de detección YOLOv8, detecta y rastrea automáticamente a cada persona que entra al establecimiento. Toda la información se visualiza en tiempo real desde cualquier navegador web.

### Vista Monitor
La pantalla principal del sistema. Muestra:
- **Feed de cámara en vivo** con bounding boxes sobre cada persona detectada, identificadas por ID y zona.
- **4 KPIs en tiempo real**: clientes en cámara, zona más activa, confianza promedio de detección y FPS de procesamiento.
- **Gráfico de barras por zona**: cuántos clientes hay en cada área del local en este momento.
- **Mapa de calor acumulado**: visualización de las zonas con mayor concentración de movimiento durante la sesión.
- **Tabla de clientes activos**: lista de cada persona detectada con su ID, zona actual, confianza y tiempo de permanencia.

### Vista Análisis
Métricas técnicas del modelo de detección y estadísticas de comportamiento:
- **Precisión, Recall y F1-Score** del modelo YOLOv8, calculados en tiempo real con anillos circulares animados.
- **Conteo de TP / FP / FN** (verdaderos positivos, falsos positivos, falsos negativos).
- **Gráfico de línea** con el promedio de clientes por hora a lo largo del día.
- **Gráfico de barras horizontales** con el tiempo promedio de permanencia por zona.

### Vista Reportes
Reporte ejecutivo descargable en PDF:
- **Resumen ejecutivo** con los KPIs más importantes de la sesión.
- **Tabla de análisis por zona** con clientes, porcentaje del total, permanencia promedio y nivel de prioridad.
- **Historial de flujo por hora** en formato de barras.
- **Recomendaciones automáticas** generadas por el sistema a partir de los datos: zonas con baja afluencia, hora pico, posibles cuellos de botella en caja, estado del modelo, etc.
- Botón **"Descargar PDF"** que exporta todo el reporte con fecha y membrete institucional.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                     BACKEND (Python)                │
│                                                     │
│  Cámara → OpenCV → YOLOv8 → Tracking por ID        │
│                    ↓                                │
│  MJPEG stream  (/video)      → Video fluido         │
│  WebSocket     (/ws/monitor) → Datos JSON (0.5s)    │
│  REST API      (/api/*)      → Historial, métricas  │
└─────────────────────────────────────────────────────┘
                         ↕ HTTP / WS
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (React + Vite)            │
│                                                     │
│  Monitor   → <img src="/video"> + WebSocket         │
│  Análisis  → fetch /api/metricas + /api/historial   │
│  Reportes  → fetch APIs + jsPDF + html2canvas       │
└─────────────────────────────────────────────────────┘
```

---

## Requisitos previos

- **Python 3.10 o superior**
- **Node.js 18 o superior** (incluye npm)
- **Git**
- Una **cámara web** conectada (USB o integrada)
- Conexión a internet la primera vez (para descargar el modelo `yolov8n.pt` automáticamente)

> **GPU opcional**: si tu equipo tiene una GPU NVIDIA con CUDA, el sistema la detecta y la usa automáticamente para acelerar la inferencia. Sin GPU, corre en CPU sin problema.

---

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/lcrisantosi7-cris/retailvision-analytics.git
cd retailvision-analytics
```

### 2. Configurar el entorno virtual de Python

Es importante usar un entorno virtual para no afectar otras instalaciones de Python en el sistema.

```bash
# Crear el entorno virtual
python -m venv venv

# Activar el entorno virtual
# En Windows:
venv\Scripts\activate

# En macOS / Linux:
source venv/bin/activate
```

> [!IMPORTANT]
> Si usas Windows y la terminal muestra un error de ejecución de scripts o permisos, ejecuta el siguiente comando en PowerShell como administrador antes de activar el entorno:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```


Una vez activado, el prompt de la terminal mostrará `(venv)` al inicio.

### 3. Instalar dependencias de Python

```bash
pip install -r requirements.txt
```

Esto instala FastAPI, Uvicorn, OpenCV, Ultralytics (YOLOv8) y el resto de dependencias del backend.

> La primera vez que se ejecute el backend, YOLOv8 descargará automáticamente el archivo `yolov8n.pt` (~6 MB). Requiere conexión a internet.

### 4. Instalar dependencias del frontend

```bash
cd frontend
npm install
cd ..
```

### 5. Configurar el índice de cámara (si es necesario)

Abre `main.py` y busca la línea:

```python
CAMERA_INDEX = 0
```

- `0` → primera cámara disponible (webcam integrada, o la única USB si no hay integrada)
- `1` → segunda cámara (USB externa cuando hay webcam integrada)
- `2` → tercera cámara, etc.

En una **PC de escritorio sin webcam integrada**, la cámara USB externa normalmente es el índice `0`.

### 6. Ejecutar el backend

Con el entorno virtual activado, desde la raíz del proyecto:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Deberías ver en la terminal:
```
[OK] Cámara 0 iniciada.
[YOLO] Usando dispositivo: cpu   (o cuda si tienes GPU)
[OK] Hilo de cámara y YOLO iniciado.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 7. Ejecutar el frontend

Abre una **segunda terminal**, activa el entorno virtual si es necesario, y ejecuta:

```bash
cd frontend
npm run dev
```

Deberías ver:
```
  VITE v6.x.x  ready in Xms

  ➜  Local:   http://localhost:5173/
```

### 8. Abrir la aplicación

Abre tu navegador y ve a:

```
http://localhost:5173
```

El sistema estará en vivo. El indicador **"En vivo"** en el header confirma la conexión con el backend.

---

## Endpoints del backend

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Estado de la API |
| `GET` | `/video` | Stream MJPEG de la cámara en vivo |
| `WS` | `/ws/monitor` | WebSocket con datos JSON en tiempo real |
| `GET` | `/api/snapshot` | Estado actual sin imágenes (debug) |
| `GET` | `/api/historial` | Promedio de clientes por hora |
| `GET` | `/api/metricas` | Precisión, Recall, F1 y tiempos por zona |
| `GET` | `/api/zonas` | Lista de zonas configuradas |

---

## Estructura del proyecto

```
├── main.py                  # Backend: FastAPI + YOLOv8 + OpenCV
├── requirements.txt         # Dependencias de Python
├── yolov8n.pt               # Modelo YOLOv8 nano (se descarga automáticamente)
├── venv/                    # Entorno virtual (no se sube a git)
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx              # Raíz de la app, navegación entre vistas
        ├── index.css            # Variables globales, tipografía Poppins
        ├── hooks/
        │   ├── useMonitor.js    # WebSocket con reconexión automática
        │   ├── useAnalisis.js   # Fetch de métricas e historial
        │   └── useReporte.js    # Fetch combinado para la vista de reportes
        ├── components/
        │   ├── Header.jsx       # Navegación: Monitor / Análisis / Reportes
        │   ├── StatCard.jsx     # Tarjeta de KPI con borde de color
        │   ├── CameraFeed.jsx   # Visor MJPEG en vivo
        │   ├── ZoneChart.jsx    # Gráfico de barras por zona (Recharts)
        │   ├── Heatmap.jsx      # Mapa de calor acumulado
        │   ├── ClientList.jsx   # Tabla de clientes activos
        │   ├── AnalisisView.jsx # Vista completa de análisis
        │   ├── MetricaBadge.jsx # Anillo circular SVG para métricas
        │   ├── HistorialChart.jsx    # Gráfico de línea por hora
        │   ├── TiempoZonaChart.jsx   # Barras horizontales de permanencia
        │   └── ReporteView.jsx  # Vista de reportes con exportación PDF
        └── utils/
            └── generarReporte.js # Lógica de recomendaciones + exportación PDF
```

---

## Zonas del local

Las zonas están definidas en `main.py` como coordenadas normalizadas (0 a 1) sobre el frame de la cámara. Por defecto el sistema divide el espacio en 5 zonas:

| Zona | Posición en el frame |
|------|----------------------|
| Entrada | 0% – 20% del ancho |
| Zona A - Ropa | 20% – 45% ancho, mitad superior |
| Zona B - Calzado | 20% – 45% ancho, mitad inferior |
| Zona C - Accesorios | 45% – 75% del ancho |
| Caja | 75% – 100% del ancho |

Para adaptar las zonas a tu local, edita el diccionario `ZONAS` en `main.py`.

---

## Solución de problemas frecuentes

**La cámara no abre**
Cambia `CAMERA_INDEX` en `main.py` a `1` o `2` y reinicia el backend.

**El video no aparece en el navegador**
Verifica que el backend esté corriendo en el puerto 8000. Abre `http://localhost:8000/video` directamente en el navegador para probar el stream.

**El indicador dice "Desconectado"**
El frontend no puede conectarse al WebSocket. Asegúrate de que el backend esté activo y que no haya un firewall bloqueando el puerto 8000.

**Bajo rendimiento / FPS bajos**
- Usa `yolov8n.pt` (nano) que es el más rápido. Ya está configurado por defecto.
- Si tienes GPU NVIDIA, instala PyTorch con soporte CUDA: [pytorch.org](https://pytorch.org/get-started/locally/)
- Reduce la resolución de captura en `main.py` cambiando `1280x720` a `640x480`.

**Error al instalar `opencv-python` en Linux**
```bash
sudo apt-get install libgl1-mesa-glx libglib2.0-0
```

---

## Tecnologías utilizadas

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — API REST y WebSocket
- [Ultralytics YOLOv8](https://docs.ultralytics.com/) — detección y tracking de personas
- [OpenCV](https://opencv.org/) — captura de cámara, procesamiento de imagen y heatmap
- [Uvicorn](https://www.uvicorn.org/) — servidor ASGI

**Frontend**
- [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Recharts](https://recharts.org/) — gráficos de barras y líneas
- [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/) — exportación a PDF
- CSS Modules + tipografía [Poppins](https://fonts.google.com/specimen/Poppins)

---

## Notas para el entorno de producción

- El archivo `venv/` y `node_modules/` están en `.gitignore` y no se suben al repositorio.
- El modelo `yolov8n.pt` se descarga automáticamente la primera vez. Si trabajas sin internet, descárgalo manualmente desde [github.com/ultralytics/assets](https://github.com/ultralytics/assets/releases) y colócalo en la raíz del proyecto.
- Para acceder desde otra computadora en la misma red, reemplaza `localhost` por la IP local del servidor en `useMonitor.js`, `useAnalisis.js`, `useReporte.js` y `CameraFeed.jsx`.
