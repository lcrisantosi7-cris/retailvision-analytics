import { useState } from 'react'
import styles from './CameraFeed.module.css'

const MJPEG_URL = 'http://localhost:8000/video'

export default function CameraFeed({ total, connected }) {
    const [imgError, setImgError] = useState(false)

    return (
        <div className={`card ${styles.wrap}`}>
            <p className="tag">Cámara en vivo</p>
            <div className={styles.frame}>
                {connected && !imgError ? (
                    <>
                        <img
                            src={MJPEG_URL}
                            alt="feed"
                            className={styles.img}
                            onError={() => setImgError(true)}
                        />
                        <div className={styles.badge}>
                            <span className={styles.badgeDot} />
                            {total} persona{total !== 1 ? 's' : ''} detectada{total !== 1 ? 's' : ''}
                        </div>
                    </>
                ) : (
                    <div className={styles.placeholder}>
                        <span className={styles.placeholderIcon}>📷</span>
                        <span>
                            {imgError
                                ? 'No se pudo conectar con la cámara'
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
