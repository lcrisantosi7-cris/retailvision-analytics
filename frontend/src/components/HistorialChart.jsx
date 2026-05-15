import {
    LineChart, Line, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts'
import styles from './HistorialChart.module.css'

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className={styles.tooltip}>
            <p className={styles.tooltipLabel}>{label}</p>
            <p className={styles.tooltipVal}>{payload[0].value} clientes (prom.)</p>
        </div>
    )
}

export default function HistorialChart({ historial }) {
    if (!historial?.length) {
        return (
            <div className={`card ${styles.empty}`}>
                <p className="tag">Clientes por hora</p>
                <div className={styles.emptyBody}>
                    <span className={styles.emptyIcon}>📊</span>
                    <span>Sin datos de historial aún</span>
                </div>
            </div>
        )
    }

    const promGlobal = historial.length
        ? (historial.reduce((s, d) => s + d.promedio, 0) / historial.length).toFixed(1)
        : 0

    return (
        <div className={`card ${styles.wrap}`}>
            <div className={styles.header}>
                <p className="tag" style={{ marginBottom: 0 }}>Clientes por hora · promedio</p>
                <span className={styles.avg}>Prom. global: <strong>{promGlobal}</strong></span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
                <LineChart data={historial} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                    <XAxis
                        dataKey="hora"
                        tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'Poppins' }}
                        axisLine={false} tickLine={false}
                    />
                    <YAxis
                        allowDecimals={false}
                        tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'Poppins' }}
                        axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine
                        y={parseFloat(promGlobal)}
                        stroke="var(--yellow)"
                        strokeDasharray="5 3"
                        strokeWidth={1.5}
                    />
                    <Line
                        type="monotone"
                        dataKey="promedio"
                        stroke="var(--accent)"
                        strokeWidth={2.5}
                        dot={{ fill: 'var(--accent)', r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
