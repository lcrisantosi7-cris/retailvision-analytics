import styles from './MetricaBadge.module.css'

/**
 * Muestra una métrica circular con nombre, valor y descripción.
 * color: 'green' | 'blue' | 'purple'
 */
export default function MetricaBadge({ label, value, desc, color = 'blue' }) {
    const pct = Math.min(Math.max(value, 0), 100)
    // SVG circle progress
    const r = 36
    const circ = 2 * Math.PI * r
    const offset = circ - (pct / 100) * circ

    return (
        <div className={`card ${styles.wrap}`}>
            <div className={styles.ring}>
                <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle
                        cx="48" cy="48" r={r}
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth="7"
                    />
                    <circle
                        cx="48" cy="48" r={r}
                        fill="none"
                        stroke={`var(--${color})`}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        transform="rotate(-90 48 48)"
                        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                </svg>
                <span className={styles.val} style={{ color: `var(--${color})` }}>
                    {pct.toFixed(1)}%
                </span>
            </div>
            <p className={styles.label}>{label}</p>
            <p className={styles.desc}>{desc}</p>
        </div>
    )
}
