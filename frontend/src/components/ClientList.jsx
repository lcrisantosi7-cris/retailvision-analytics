import styles from './ClientList.module.css'

const ZONA_META = {
    'Entrada': { color: '#f59e0b', bg: '#f59e0b18' },
    'Zona A - Ropa': { color: '#4f6ef7', bg: '#4f6ef718' },
    'Zona B - Calzado': { color: '#22c55e', bg: '#22c55e18' },
    'Zona C - Accesorios': { color: '#8b5cf6', bg: '#8b5cf618' },
    'Caja': { color: '#f97316', bg: '#f9731618' },
}

function fmt(seg) {
    if (seg < 60) return `${seg}s`
    return `${Math.floor(seg / 60)}m ${seg % 60}s`
}

export default function ClientList({ clientes }) {
    if (!clientes?.length) {
        return (
            <div className={`card ${styles.empty}`}>
                <span className={styles.emptyIcon}>👤</span>
                <p className="tag" style={{ marginBottom: 0 }}>Clientes activos</p>
                <p className={styles.none}>Sin clientes en cámara</p>
            </div>
        )
    }

    return (
        <div className={`card ${styles.wrap}`}>
            <p className="tag">Clientes activos · {clientes.length} detectados</p>
            <div className={styles.scroll}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Zona</th>
                            <th>Confianza</th>
                            <th>Tiempo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clientes.map(c => {
                            const meta = ZONA_META[c.zona] ?? { color: 'var(--muted)', bg: '#8b93b018' }
                            return (
                                <tr key={c.id} className={`${styles.row} fade-in`}>
                                    <td className={styles.id}>#{c.id}</td>
                                    <td>
                                        <span
                                            className={styles.zonaBadge}
                                            style={{ color: meta.color, background: meta.bg }}
                                        >
                                            {c.zona}
                                        </span>
                                    </td>
                                    <td className={styles.conf}>
                                        {(c.confianza * 100).toFixed(0)}%
                                    </td>
                                    <td className={styles.time}>{fmt(c.tiempo_en_zona)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
