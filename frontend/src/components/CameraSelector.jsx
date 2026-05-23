import styles from './CameraSelector.module.css'

/**
 * CameraSelector
 * --------------
 * Muestra una lista de cámaras disponibles y permite seleccionar la activa.
 * Props:
 *   cameras   — array de { id, nombre, activa, fps, total_clientes }
 *   selected  — cam_id actualmente seleccionado
 *   onSelect  — callback(cam_id)
 */
export default function CameraSelector({ cameras = [], selected, onSelect }) {
    if (cameras.length <= 1) return null   // con una sola cámara no hace falta el selector

    return (
        <div className={styles.wrap}>
            <span className={styles.label}>Cámara</span>
            <div className={styles.list}>
                {cameras.map((cam) => (
                    <button
                        key={cam.id}
                        className={`${styles.btn} ${selected === cam.id ? styles.active : ''}`}
                        onClick={() => onSelect(cam.id)}
                        title={cam.nombre}
                    >
                        <span className={`${styles.dot} ${cam.activa ? styles.dotOn : styles.dotOff}`} />
                        <span className={styles.nombre}>{cam.nombre}</span>
                        {cam.activa && (
                            <span className={styles.fps}>{cam.fps} fps</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    )
}
