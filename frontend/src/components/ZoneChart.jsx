import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import styles from './ZoneChart.module.css'

const PALETTE = ['#4f6ef7', '#f97316', '#22c55e', '#f59e0b', '#8b5cf6']

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className={styles.tooltip}>
            <p className={styles.tooltipLabel}>{label}</p>
            <p className={styles.tooltipVal}>{payload[0].value} personas</p>
        </div>
    )
}

export default function ZoneChart({ conteo_zonas }) {
    const data = Object.entries(conteo_zonas || {}).map(([zona, count]) => ({
        zona: zona.replace('Zona ', '').replace(' - ', ' '),
        count,
    }))

    return (
        <div className={`card ${styles.wrap}`}>
            <p className="tag">Clientes por zona</p>
            <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis
                        dataKey="zona"
                        tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'Poppins' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        allowDecimals={false}
                        tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'Poppins' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#4f6ef708' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
                        {data.map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.9} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
