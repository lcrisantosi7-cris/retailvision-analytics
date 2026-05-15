import styles from './Heatmap.module.css'

export default function Heatmap({ heatmap_b64 }) {
    return (
        <div className={`card ${styles.wrap}`}>
            <p className="tag">Mapa de calor · sesión</p>
            <div className={styles.frame}>
                {heatmap_b64 ? (
                    <>
                        <img
                            src={`data:image/png;base64,${heatmap_b64}`}
                            alt="heatmap"
                            className={styles.img}
                        />
                        <div className={styles.overlay}>
                            {['Entrada', 'Zona A', 'Zona B', 'Zona C', 'Caja'].map((z, i) => (
                                <span key={i} className={styles.zlabel}>{z}</span>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className={styles.placeholder}>
                        <span className={styles.placeholderIcon}>🔥</span>
                        <span>Sin datos aún</span>
                    </div>
                )}
            </div>
        </div>
    )
}
