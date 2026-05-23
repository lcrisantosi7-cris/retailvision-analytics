import { useState } from 'react'
import './index.css'

import { useMonitor, useCameraList } from './hooks/useMonitor'

import Header from './components/Header'
import StatCard from './components/StatCard'
import CameraFeed from './components/CameraFeed'
import CameraSelector from './components/CameraSelector'
import ZoneChart from './components/ZoneChart'
import Heatmap from './components/Heatmap'
import ClientList from './components/ClientList'
import AnalisisView from './components/AnalisisView'
import ReporteView from './components/ReporteView'

import styles from './App.module.css'

export default function App() {
  const [vista, setVista] = useState('monitor')
  const [camId, setCamId] = useState('cam_01')

  // Lista de cámaras disponibles (se refresca cada 5 s)
  const { cameras } = useCameraList()

  // Estado en tiempo real de la cámara seleccionada
  const { data, connected, error } = useMonitor(camId)

  // Nombre de la cámara activa
  const camNombre = cameras.find(c => c.id === camId)?.nombre ?? camId

  // Zona con más clientes
  const zonaPico = Object.entries(data.conteo_zonas || {})
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // Confianza promedio
  const confPromedio = data.clientes?.length
    ? (data.clientes.reduce((s, c) => s + c.confianza, 0) / data.clientes.length * 100).toFixed(0)
    : 0

  return (
    <div className={styles.layout}>
      <Header
        connected={connected}
        fps={data.fps}
        timestamp={data.timestamp}
        vista={vista}
        onVista={setVista}
      />

      {error && (
        <div className={styles.error}>
          ⚠ {error} — asegúrate de que el backend esté corriendo en puerto 8000
        </div>
      )}

      {/* ── Selector de cámara (visible en todas las vistas) ── */}
      <CameraSelector
        cameras={cameras}
        selected={camId}
        onSelect={setCamId}
      />

      {/* ── Vista Monitor ── */}
      {vista === 'monitor' && (
        <>
          <section className={styles.kpis}>
            <StatCard
              label="Clientes ahora"
              value={data.total_clientes}
              color={data.total_clientes > 0 ? 'var(--accent)' : 'var(--muted)'}
            />
            <StatCard
              label="Zona más activa"
              value={zonaPico}
              color="var(--yellow)"
            />
            <StatCard
              label="Confianza detección"
              value={confPromedio}
              unit="%"
              color="var(--green)"
            />
            <StatCard
              label="FPS procesamiento"
              value={data.fps}
              color={data.fps >= 20 ? 'var(--green)' : 'var(--red)'}
            />
          </section>

          <section className={styles.main}>
            <CameraFeed
              camId={camId}
              nombre={camNombre}
              total={data.total_clientes}
              connected={connected}
            />
            <div className={styles.sidebar}>
              <ZoneChart conteo_zonas={data.conteo_zonas} />
              <Heatmap heatmap_b64={data.heatmap_b64} />
            </div>
          </section>

          <section className={styles.bottom}>
            <ClientList clientes={data.clientes} />
          </section>
        </>
      )}

      {/* ── Vista Análisis ── */}
      {vista === 'analisis' && (
        <AnalisisView activo={vista === 'analisis'} camId={camId} camNombre={camNombre} />
      )}

      {/* ── Vista Reportes ── */}
      {vista === 'reporte' && (
        <ReporteView activo={vista === 'reporte'} camId={camId} camNombre={camNombre} />
      )}
    </div>
  )
}
