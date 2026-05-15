import styles from './Header.module.css'

export default function Header({ connected, fps, timestamp, vista, onVista }) {
    const hora = timestamp
        ? new Date(timestamp).toLocaleTimeString('es-PE')
        : '--:--:--'

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <div className={styles.logoMark}>R</div>
                <div className={styles.logoText}>
                    <span className={styles.logoName}>
                        Retail<span>Monitor</span>
                    </span>
                    <span className={styles.sub}>Sistema de análisis · Piura 2026</span>
                </div>
            </div>

            {/* Navegación central */}
            <nav className={styles.nav}>
                <button
                    className={`${styles.navBtn} ${vista === 'monitor' ? styles.navActive : ''}`}
                    onClick={() => onVista('monitor')}
                >
                    Monitor
                </button>
                <button
                    className={`${styles.navBtn} ${vista === 'analisis' ? styles.navActive : ''}`}
                    onClick={() => onVista('analisis')}
                >
                    Análisis
                </button>
                <button
                    className={`${styles.navBtn} ${vista === 'reporte' ? styles.navActive : ''}`}
                    onClick={() => onVista('reporte')}
                >
                    Reportes
                </button>
            </nav>

            <div className={styles.right}>
                <div className={styles.pill}>
                    <span>FPS</span>
                    <strong style={{ color: fps >= 20 ? 'var(--green)' : 'var(--yellow)' }}>
                        {fps ?? 0}
                    </strong>
                </div>

                <div className={styles.pill}>
                    <span>🕐</span>
                    <strong>{hora}</strong>
                </div>

                <div className={`${styles.statusPill} ${connected ? styles.on : styles.off}`}>
                    <span className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
                    {connected ? 'En vivo' : 'Desconectado'}
                </div>
            </div>
        </header>
    )
}
