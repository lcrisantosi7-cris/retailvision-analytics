import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell, LabelList
} from 'recharts'
import styles from './TiempoZonaChart.module.css'

const PALETTE = ['#4f6ef7', '#f97316', '#22c55e', '#f59e0b', '#8b5cf6']

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className={styles.tooltip}>
            <p className={styles.tooltipLabel}>{label}</p>
            <p className={styles.tooltipVal}>{payload[0].value}s promedio</p>
        </div>
    )
}

function fmtSeg(s) {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function TiempoZonaChart({ tiempo_promedio_zona }) {
    const data = Object.entries(tiempo_promedio_zona || {})
        .map(([zona, seg]) => ({
            zona: zona.replace('Zona ', '').replace(' - ', ' '),
            seg,
            label: fmtSeg(seg),
        }))
        .sort((a, b) => b.seg - a.seg)

    const hayDatos = data.some(d => d.seg > 0)

    if (!hayDatos) {
        return (
            <div className={`card ${styles.empty}`}>
                <p className="tag">Permanencia promedio por zona</p>
                <div className={styles.emptyBody}>
                    <span className={styles.emptyIcon}>⏱</span>
                    <span>Sin datos de permanencia aún</span>
                </div>
            </div>
        )
    }

    return (
        <div className={`card ${styles.wrap}`}>
            <p className="tag">Permanencia promedio por zona</p>
            <ResponsiveContainer width="100%" height={200}>
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 8, bottom: 0 }}
                >
                    <XAxis
                        type="number"
                        tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'Poppins' }}
                        axisLine={false} tickLine={false}
                        tickFormatter={v => `${v}s`}
                    />
                    <YAxis
                        type="category"
                        dataKey="zona"
                        width={90}
                        tick={{ fill: 'var(--text)', fontSize: 11, fontFamily: 'Poppins' }}
                        axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#4f6ef708' }} />
                    <Bar dataKey="seg" radius={[0, 4, 4, 0]} maxBarSize={22}>
                        {data.map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} />
                        ))}
                        <LabelList
                            dataKey="label"
                            position="right"
                            style={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'Poppins' }}
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
