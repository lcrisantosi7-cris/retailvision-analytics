import styles from './StatCard.module.css'

export default function StatCard({ label, value, unit = '', color = 'var(--accent)' }) {
    return (
        <div className={`card ${styles.card}`} style={{ borderLeftColor: color }}>
            <p className="tag">{label}</p>
            <p className={styles.value}>
                {value ?? '—'}
                {unit && <span className={styles.unit}>{unit}</span>}
            </p>
        </div>
    )
}
