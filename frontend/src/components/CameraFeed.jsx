import { useState, useEffect } from 'react'
import styles from './CameraFeed.module.css'

const BASE = 'http://localhost:8000'

export default function CameraFeed({ camId = 'cam_01', nombre = 'Cámara', total, connected }) {
    const [imgError, setImgError] = useState(false)
    const mjpegUrl = `${BASE}/video/${camId}`

    // Resetear error cuando cambia la cámara seleccionada
    useEffect(() => {
        setImgError(false)
    }, [camId])

    return (
        <div className={`card ${styles.wrap}`}>
            <div className={styles.header}>
                <p className="tag">Cámara en vivo</p>
                <span className={styles.camName}>{nombre}</span>
            </div>

            <div className={styles.frame}>
                {connected && !imgError ? (
                    <>
                        <img
                            key={camId}           /* fuerza remount al cambiar cámara */
                            src={mjpegUrl}
                            alt={`feed-${camId}`}
                            className={styles.img}
                            onError={() => setImgError(true)}
                        />
                        <div className={styles.badge}>
                            <span className={styles.badgeDot} />
                            {total} persona{total !== 1 ? 's' : ''} detectada{total !== 1 ? 's' : ''}
                        </div>
                        <div className={styles.camIdBadge}>{camId}</div>
                    </>
                ) : (
                    <div className={styles.placeholder}>
                        <span className={styles.placeholderIcon}>📷</span>
                        <span>
                            {imgError
                                ? `No se pudo conectar con ${nombre}`
                                : 'Esperando señal de cámara…'}
                        </span>
                        {imgError && (
                            <button
                                className={styles.retryBtn}
                                onClick={() => setImgError(false)}
                            >
                                Reintentar
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
