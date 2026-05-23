# RetailVision Analytics — Frontend

Interfaz web del sistema de monitoreo, construida con React 19 + Vite.

## Comandos

```bash
npm install      # instalar dependencias
npm run dev      # servidor de desarrollo → http://localhost:5173
npm run build    # compilar para producción
npm run preview  # previsualizar build de producción
```

## Dependencias principales

| Paquete | Uso |
|---------|-----|
| react + react-dom | UI |
| recharts | Gráficos de barras y líneas |
| jspdf + html2canvas | Exportación a PDF |
| lucide-react | Iconos |

## Estructura

```
src/
├── App.jsx              # Raíz, navegación y selector de cámara
├── index.css            # Variables CSS globales
├── hooks/
│   ├── useMonitor.js    # WebSocket por cámara
│   ├── useAnalisis.js   # Métricas e historial por cámara
│   └── useReporte.js    # Datos combinados para reportes
└── components/          # Componentes de UI
```

El frontend espera el backend en `http://localhost:8000`. Para cambiar la URL edita las constantes `BASE` / `BASE_WS` en los hooks.
