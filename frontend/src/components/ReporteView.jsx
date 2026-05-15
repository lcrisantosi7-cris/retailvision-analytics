import { useRef, useState } from 'react'
import { useReporte } from '../hooks/useReporte'
import { generarRecomendaciones, exportarPDF } from '../utils/generarReporte'
import styles from './ReporteView.module.css'

const ZONA_COLOR = {
    'Entrada': '#f59e0b',
    'Zona A - Ropa': '#4f6ef7',
    'Zona B - Calzado': '#22c55e',
    'Zona C - Accesorios': '#8b5cf6',
    'Caja': '#f97316',
}

function fmt(seg) {
    if (!seg || seg === 0) return '—'
    if (seg < 60) return `${seg}s`
    return `${Math.floor(seg / 60)}m ${seg % 60}s`
}

function Badge({ tipo }) {
    const map = {
        positivo: { label: 'Oportunidad', color: '#22c55e', bg: '#22c55e14' },
        alerta: { label: 'Atención', color: '#f59e0b', bg: '#f59e0b14' },
        info: { label: 'Información', color: '#4f6ef7', bg: '#4f6ef714' },
    }
    const m = map[tipo] ?? map.info
    return (
        <span className={styles.badge} style={{ color: m.color, background: m.bg }}>
            {m.label}
        </span>
    )
}

export default function ReporteView({ activo }) {
    const { data, loading, error, lastUpdate, refetch } = useReporte(activo)
    const [exportando, setExportando] = useState(false)
    const reporteRef = useRef(null)

    const handleExport = async () => {
        setExportando(true)
        await exportarPDF('reporte-contenido', 'reporte-retailmonitor')
        setExportando(false)
    }

    if (loading && !data) {
        return (
            <div className={styles.loading}>
                <span className={styles.loadingIcon}>⏳</span>
                <p>Cargando datos del reporte…</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className={styles.errorWrap}>
                <span>⚠️</span>
                <p>{error}</p>
                <button className={styles.retryBtn} onClick={refetch}>Reintentar</button>
            </div>
        )
    }

    if (!data) return null

    const { metricas, historial, snapshot } = data
    const conteo = snapshot?.conteo_zonas ?? {}
    const zonas = metricas?.tiempo_promedio_zona ?? {}
    const recomendaciones = generarRecomendaciones(metricas, snapshot, historial)

    // Totales para la tabla de zonas
    const totalVisitas = Object.values(conteo).reduce((s, v) => s + v, 0) || 1

    // Hora pico
    const horaPico = historial?.length
        ? [...historial].sort((a, b) => b.promedio - a.promedio)[0]
        : null

    const fechaReporte = new Date().toLocaleDateString('es-PE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    return (
        <div className={styles.layout}>

            {/* ── Barra de acciones (fuera del PDF) ── */}
            <div className={styles.toolbar}>
                <div className={styles.toolbarLeft}>
                    <span className={styles.toolbarTitle}>Reporte de sesión</span>
                    {lastUpdate && (
                        <span className={styles.toolbarSub}>
                            Actualizado: {lastUpdate.toLocaleTimeString('es-PE')}
                        </span>
                    )}
                </div>
                <div className={styles.toolbarRight}>
                    <button className={styles.refreshBtn} onClick={refetch} disabled={loading}>
                        {loading ? 'Actualizando…' : '↻ Actualizar'}
                    </button>
                    <button
                        className={styles.exportBtn}
                        onClick={handleExport}
                        disabled={exportando}
                    >
                        {exportando ? 'Generando PDF…' : '⬇ Descargar PDF'}
                    </button>
                </div>
            </div>

            {/* ── Contenido del reporte (esto se captura para el PDF) ── */}
            <div id="reporte-contenido" ref={reporteRef} className={styles.reporte}>

                {/* Encabezado del reporte */}
                <div className={styles.reporteHeader}>
                    <div className={styles.reporteLogo}>
                        <div className={styles.reporteLogoMark}>R</div>
                        <div>
                            <p className={styles.reporteLogoName}>RetailMonitor</p>
                            <p className={styles.reporteLogoSub}>Sistema de análisis de comportamiento de clientes</p>
                        </div>
                    </div>
                    <div className={styles.reporteMeta}>
                        <p className={styles.reporteFecha}>{fechaReporte}</p>
                        <p className={styles.reporteSubtitle}>Reporte de toma de decisiones comerciales · Piura 2026</p>
                    </div>
                </div>

                <div className={styles.divider} />

                {/* ── Resumen ejecutivo ── */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Resumen ejecutivo</h2>
                    <div className={styles.kpis}>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiVal} style={{ color: 'var(--accent)' }}>
                                {snapshot?.total_clientes ?? 0}
                            </span>
                            <span className={styles.kpiLabel}>Clientes en cámara</span>
                        </div>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiVal} style={{ color: 'var(--yellow)' }}>
                                {horaPico?.hora ?? '—'}
                            </span>
                            <span className={styles.kpiLabel}>Hora pico</span>
                        </div>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiVal} style={{ color: 'var(--green)' }}>
                                {metricas?.precision ?? 0}%
                            </span>
                            <span className={styles.kpiLabel}>Precisión del modelo</span>
                        </div>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiVal} style={{ color: 'var(--purple)' }}>
                                {metricas?.f1 ?? 0}%
                            </span>
                            <span className={styles.kpiLabel}>F1-Score</span>
                        </div>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiVal} style={{ color: 'var(--orange)' }}>
                                {metricas?.frames_procesados?.toLocaleString() ?? 0}
                            </span>
                            <span className={styles.kpiLabel}>Frames procesados</span>
                        </div>
                    </div>
                </section>

                <div className={styles.divider} />

                {/* ── Tabla de zonas ── */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Análisis por zona</h2>
                    <p className={styles.sectionDesc}>
                        Distribución de clientes, tiempo de permanencia promedio y participación
                        relativa de cada zona del establecimiento.
                    </p>
                    <table className={styles.tabla}>
                        <thead>
                            <tr>
                                <th>Zona</th>
                                <th>Clientes actuales</th>
                                <th>% del total</th>
                                <th>Permanencia prom.</th>
                                <th>Prioridad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(conteo)
                                .sort((a, b) => b[1] - a[1])
                                .map(([zona, cnt]) => {
                                    const pct = ((cnt / totalVisitas) * 100).toFixed(1)
                                    const color = ZONA_COLOR[zona] ?? 'var(--muted)'
                                    const tprom = zonas[zona] ?? 0
                                    const prioridad = cnt === 0 ? 'Baja' : cnt >= 3 ? 'Alta' : 'Media'
                                    const prioColor = cnt === 0 ? 'var(--red)' : cnt >= 3 ? 'var(--green)' : 'var(--yellow)'
                                    return (
                                        <tr key={zona}>
                                            <td>
                                                <span className={styles.zonaTag} style={{ color, borderColor: color + '40', background: color + '12' }}>
                                                    {zona}
                                                </span>
                                            </td>
                                            <td className={styles.tablaNum}>{cnt}</td>
                                            <td>
                                                <div className={styles.barWrap}>
                                                    <div
                                                        className={styles.bar}
                                                        style={{ width: `${pct}%`, background: color }}
                                                    />
                                                    <span>{pct}%</span>
                                                </div>
                                            </td>
                                            <td className={styles.tablaNum}>{fmt(tprom)}</td>
                                            <td>
                                                <span className={styles.prioTag} style={{ color: prioColor }}>
                                                    {prioridad}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </table>
                </section>

                <div className={styles.divider} />

                {/* ── Historial por hora ── */}
                {historial?.length > 0 && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Flujo de clientes por hora</h2>
                        <p className={styles.sectionDesc}>
                            Promedio de clientes registrados en cada franja horaria durante la sesión.
                        </p>
                        <div className={styles.historialGrid}>
                            {historial.map(({ hora, promedio }) => {
                                const maxProm = Math.max(...historial.map(h => h.promedio), 1)
                                const pct = (promedio / maxProm) * 100
                                return (
                                    <div key={hora} className={styles.historialItem}>
                                        <div className={styles.historialBarWrap}>
                                            <div
                                                className={styles.historialBar}
                                                style={{ height: `${Math.max(pct, 4)}%` }}
                                            />
                                        </div>
                                        <span className={styles.historialVal}>{promedio}</span>
                                        <span className={styles.historialHora}>{hora}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )}

                {historial?.length > 0 && <div className={styles.divider} />}

                {/* ── Recomendaciones ── */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Recomendaciones para la gestión comercial</h2>
                    <p className={styles.sectionDesc}>
                        Decisiones sugeridas generadas automáticamente a partir del análisis
                        de comportamiento de clientes en el establecimiento.
                    </p>
                    {recomendaciones.length === 0 ? (
                        <p className={styles.sinDatos}>
                            Aún no hay suficientes datos para generar recomendaciones.
                            El sistema necesita procesar más frames de actividad.
                        </p>
                    ) : (
                        <div className={styles.recomendaciones}>
                            {recomendaciones.map((r, i) => (
                                <div key={i} className={`${styles.recomCard} ${styles[r.tipo]}`}>
                                    <div className={styles.recomTop}>
                                        <span className={styles.recomIcono}>{r.icono}</span>
                                        <div className={styles.recomTexto}>
                                            <div className={styles.recomTituloRow}>
                                                <p className={styles.recomTitulo}>{r.titulo}</p>
                                                <Badge tipo={r.tipo} />
                                            </div>
                                            <p className={styles.recomDetalle}>{r.detalle}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Pie del reporte */}
                <div className={styles.divider} />
                <div className={styles.footer}>
                    <span>RetailMonitor · Sistema inteligente de análisis de comportamiento de clientes</span>
                    <span>Universidad César Vallejo · Piura 2026</span>
                </div>

            </div>
        </div>
    )
}
