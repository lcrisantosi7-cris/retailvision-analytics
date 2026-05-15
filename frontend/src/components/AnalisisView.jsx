import { useAnalisis } from '../hooks/useAnalisis'
import MetricaBadge from './MetricaBadge'
import HistorialChart from './HistorialChart'
import TiempoZonaChart from './TiempoZonaChart'
import styles from './AnalisisView.module.css'

export default function AnalisisView({ activo }) {
    const { data, loading, error } = useAnalisis(activo)
    const { metricas, historial } = data

    return (
        <div className={styles.layout}>

            {/* Banner de error */}
            {error && (
                <div className={styles.error}>⚠ {error}</div>
            )}

            {/* ── Sección: Métricas del modelo ── */}
            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2 className={styles.sectionTitle}>Métricas del modelo</h2>
                    <span className={styles.sectionSub}>
                        Evaluación en tiempo real · {metricas.frames_procesados.toLocaleString()} frames procesados
                    </span>
                </div>

                <div className={styles.metricas}>
                    <MetricaBadge
                        label="Precisión"
                        value={metricas.precision}
                        desc="Detecciones correctas sobre el total de detecciones realizadas"
                        color="accent"
                    />
                    <MetricaBadge
                        label="Recall"
                        value={metricas.recall}
                        desc="Personas detectadas sobre el total de personas presentes"
                        color="green"
                    />
                    <MetricaBadge
                        label="F1-Score"
                        value={metricas.f1}
                        desc="Media armónica entre precisión y recall"
                        color="purple"
                    />
                </div>

                {/* Detalle TP / FP / FN */}
                <div className={styles.detalle}>
                    <div className={styles.detalleItem}>
                        <span className={styles.detalleVal} style={{ color: 'var(--green)' }}>
                            {metricas.tp.toLocaleString()}
                        </span>
                        <span className={styles.detalleLabel}>Verdaderos positivos</span>
                    </div>
                    <div className={styles.detalleSep} />
                    <div className={styles.detalleItem}>
                        <span className={styles.detalleVal} style={{ color: 'var(--yellow)' }}>
                            {metricas.fp.toLocaleString()}
                        </span>
                        <span className={styles.detalleLabel}>Falsos positivos</span>
                    </div>
                    <div className={styles.detalleSep} />
                    <div className={styles.detalleItem}>
                        <span className={styles.detalleVal} style={{ color: 'var(--red)' }}>
                            {metricas.fn.toLocaleString()}
                        </span>
                        <span className={styles.detalleLabel}>Falsos negativos</span>
                    </div>
                </div>
            </section>

            {/* ── Sección: Historial + Permanencia ── */}
            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2 className={styles.sectionTitle}>Comportamiento temporal</h2>
                    <span className={styles.sectionSub}>
                        Flujo de clientes y tiempo de permanencia por zona
                    </span>
                </div>

                <div className={styles.charts}>
                    <div className={styles.chartMain}>
                        <HistorialChart historial={historial} />
                    </div>
                    <div className={styles.chartSide}>
                        <TiempoZonaChart tiempo_promedio_zona={metricas.tiempo_promedio_zona} />
                    </div>
                </div>
            </section>

            {loading && <div className={styles.refreshing}>Actualizando…</div>}
        </div>
    )
}
