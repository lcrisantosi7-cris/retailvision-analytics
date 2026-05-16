# RetailMonitor

> Sistema inteligente de monitoreo y análisis de comportamiento de clientes en establecimientos comerciales, desarrollado con visión artificial (YOLOv8) y una interfaz web en tiempo real.

**Proyecto de investigación aplicada**

---

## ¿Qué hace el sistema?

RetailMonitor conecta una cámara al local comercial y, usando el modelo de detección YOLOv8, detecta y rastrea automáticamente a cada persona que entra al establecimiento. Toda la información se visualiza en tiempo real desde cualquier navegador web.

---

## Vistas del sistema

### 🖥️ Vista Monitor
La pantalla principal del sistema. Muestra:
- **Feed de cámara en vivo** con bounding boxes sobre cada persona detectada, identificadas por ID y zona.
- **4 KPIs en tiempo real**: clientes en cámara, zona más activa, confianza promedio de detección y FPS de procesamiento.
- **Gráfico de barras por zona**: cuántos clientes hay en cada área del local en este momento.
- **Mapa de calor acumulado**: visualización de las zonas con mayor concentración de movimiento durante la sesión.
- **Tabla de clientes activos**: lista de cada persona detectada con su ID, zona actual, confianza y tiempo de permanencia.

### 📊 Vista Análisis
Métricas técnicas del modelo de detección y estadísticas de comportamiento:
- **Precisión, Recall y F1-Score** del modelo YOLOv8, calculados en tiempo real con anillos circulares animados.
- **Conteo de TP / FP / FN** (verdaderos positivos, falsos positivos, falsos negativos).
- **Gráfico de línea** con el promedio de clientes por hora a lo largo del día.
- **Gráfico de barras horizontales** con el tiempo promedio de permanencia por zona.

### 📄 Vista Reportes
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

> [!TIP]
> **GPU opcional**: si tu equipo tiene una GPU NVIDIA con CUDA, el sistema la detecta y la usa automáticamente para acelerar la inferencia. Sin GPU, corre perfectamente en CPU.

---

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/lcrisantosi7-cris/retailvision-analytics.git
cd retailvision-analytics
```

### 2. Configurar el entorno virtual de Python

```bash
# Crear el entorno virtual
python -m venv venv

# Activar — Windows
venv\Scripts\activate

# Activar — macOS / Linux
source venv/bin/activate
```

> [!IMPORTANT]
> Si usas Windows y la terminal muestra un error de permisos al activar el entorno, ejecuta esto en **PowerShell como administrador** antes de continuar:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> Una vez activado correctamente, el prompt mostrará `(venv)` al inicio de cada línea.

### 3. Instalar dependencias de Python

```bash
pip install -r requirements.txt
```

> [!NOTE]
> La primera vez que arranque el backend, YOLOv8 descargará automáticamente el archivo `yolov8n.pt` (~6 MB). Asegúrate de tener conexión a internet en ese momento.

### 4. Instalar dependencias del frontend

```bash
cd frontend
npm install
cd ..
```

### 5. Configurar el índice de cámara

Abre `main.py` y localiza la línea:

```python
CAMERA_INDEX = 0
```

| Valor | Cuándo usarlo |
|-------|---------------|
| `0`   | Webcam integrada de laptop, o única cámara USB en PC de escritorio |
| `1`   | Cámara USB externa cuando ya hay webcam integrada |
| `2`   | Tercera cámara disponible |

> [!TIP]
> Si no sabes qué índice usar, prueba con `0`. Si la cámara no abre, cambia a `1` y reinicia el backend.

### 6. Ejecutar el backend

Con el entorno virtual activado, desde la raíz del proyecto:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Una salida exitosa se ve así:

```
[OK] Cámara 0 iniciada.
[YOLO] Usando dispositivo: cpu   ← (o "cuda" si tienes GPU NVIDIA)
[OK] Hilo de cámara y YOLO iniciado.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 7. Ejecutar el frontend

Abre una **segunda terminal** y ejecuta:

```bash
cd frontend
npm run dev
```

```
  VITE v6.x.x  ready in Xms
  ➜  Local:   http://localhost:5173/
```

### 8. Abrir la aplicación

```
http://localhost:5173
```

El indicador **"En vivo"** en el header confirma que el frontend está conectado al backend.

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

> [!TIP]
> Con el backend corriendo, ve a `http://localhost:8000/docs` para ver la documentación interactiva de todos los endpoints (Swagger UI).

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
        │   ├── Header.jsx            # Navegación: Monitor / Análisis / Reportes
        │   ├── StatCard.jsx          # Tarjeta de KPI con borde de color
        │   ├── CameraFeed.jsx        # Visor MJPEG en vivo
        │   ├── ZoneChart.jsx         # Gráfico de barras por zona (Recharts)
        │   ├── Heatmap.jsx           # Mapa de calor acumulado
        │   ├── ClientList.jsx        # Tabla de clientes activos
        │   ├── AnalisisView.jsx      # Vista completa de análisis
        │   ├── MetricaBadge.jsx      # Anillo circular SVG para métricas
        │   ├── HistorialChart.jsx    # Gráfico de línea por hora
        │   ├── TiempoZonaChart.jsx   # Barras horizontales de permanencia
        │   └── ReporteView.jsx       # Vista de reportes con exportación PDF
        └── utils/
            └── generarReporte.js     # Lógica de recomendaciones + exportación PDF
```

---

## Zonas del local

Las zonas se definen en `main.py` como coordenadas normalizadas (0 a 1) sobre el frame de la cámara. Por defecto el sistema divide el espacio en 5 zonas:

| Zona | Posición en el frame |
|------|----------------------|
| Entrada | 0% – 20% del ancho |
| Zona A - Ropa | 20% – 45% ancho, mitad superior |
| Zona B - Calzado | 20% – 45% ancho, mitad inferior |
| Zona C - Accesorios | 45% – 75% del ancho |
| Caja | 75% – 100% del ancho |

> [!NOTE]
> Para adaptar las zonas a la distribución real de tu local, edita el diccionario `ZONAS` en `main.py`. Las coordenadas son fracciones del ancho/alto del frame, por lo que no dependen de la resolución de la cámara.

---

## Solución de problemas

**La cámara no abre**

Cambia `CAMERA_INDEX` en `main.py` a `1` o `2` y reinicia el backend.

> [!WARNING]
> Si otra aplicación está usando la cámara (Teams, Zoom, OBS, etc.), el backend no podrá acceder a ella. Cierra esas apps antes de iniciar el sistema.

---

**El video no aparece en el navegador**

Abre `http://localhost:8000/video` directamente en el navegador para verificar que el stream MJPEG funciona antes de culpar al frontend.

---

**El indicador dice "Desconectado"**

El frontend no puede conectarse al WebSocket. Verifica que el backend esté activo en el puerto 8000 y que no haya un firewall bloqueando la conexión.

---

**FPS bajos o procesamiento lento**

> [!TIP]
> Prueba estas opciones en orden, de menor a mayor impacto:
> 1. Confirma que estás usando `yolov8n.pt` (nano) — ya está configurado por defecto.
> 2. Instala PyTorch con soporte CUDA si tienes GPU NVIDIA: [pytorch.org](https://pytorch.org/get-started/locally/)
> 3. Reduce la resolución en `main.py` de `1280×720` a `640×480`.

---

**Error al instalar `opencv-python` en Linux**

> [!CAUTION]
> En sistemas Linux sin entorno gráfico (servidores, WSL) `opencv-python` puede fallar por dependencias faltantes. Instálalas así:
> ```bash
> sudo apt-get install libgl1-mesa-glx libglib2.0-0
> ```
> Luego vuelve a ejecutar `pip install -r requirements.txt`.

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

## Notas para producción

> [!IMPORTANT]
> Los directorios `venv/` y `node_modules/` están en `.gitignore` y **no se suben al repositorio**. Cada colaborador debe ejecutar los pasos de instalación en su propia máquina.

> [!NOTE]
> Para acceder al sistema desde otra computadora en la misma red local, reemplaza `localhost` por la IP local del servidor (ej. `192.168.1.X`) en estos archivos:
> - `useMonitor.js`
> - `useAnalisis.js`
> - `useReporte.js`
> - `CameraFeed.jsx`

> [!TIP]
> Si trabajas sin internet, descarga el modelo manualmente desde [github.com/ultralytics/assets](https://github.com/ultralytics/assets/releases) y coloca el archivo `yolov8n.pt` en la raíz del proyecto antes de iniciar el backend.

---

*RetailMonitor · Lima 2026*
