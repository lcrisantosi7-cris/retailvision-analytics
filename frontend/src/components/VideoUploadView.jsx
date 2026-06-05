import { useState, useRef, useEffect, useCallback } from 'react'
import styles from './VideoUploadView.module.css'

const BASE = 'http://localhost:8000'

const ZONAS_COLOR = {
    'Entrada': '#f59e0b',
    'Zona Ropa': '#4f6ef7',
    'Zona Mostrador': '#22c55e',
    'Zona Probadores': '#8b5cf6',
    'Caja': '#f97316',
}

function getZonaColor(zona) {
    return ZONAS_COLOR[zona] ?? '#94a3b8'
}

function fmtSeg(seg) {
    if (!seg || seg === 0) return '—'
    if (seg < 60) return `${seg}s`
    return `${Math.floor(seg / 60)}m ${Math.round(seg % 60)}s`
}

export default function VideoUploadView() {
    const [fase, setFase] = useState('idle')
    const [jobId, setJobId] = useState(null)
    const [job, setJob] = useState(null)
    const [archivoNombre, setArchivoNombre] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [imgErr, setImgErr] = useState(false)
    const fileRef = useRef(null)
    const pollRef = useRef(null)

    const pollStatus = useCallback(async (id) => {
        try {
            const res = await fetch(`${BASE}/api/video-status/${id}`)
            const data = await res.json()
            setJob(data)
            if (data.estado === 'completado' || data.estado === 'error') {
                clearInterval(pollRef.current)
                setFase(data.estado)
            }
        } catch { /* reintentar en el próximo tick */ }
    }, [])

    useEffect(() => () => clearInterval(pollRef.current), [])

    const subirVideo = async (file) => {
        if (!file) return
        const ext = file.name.split('.').pop().toLowerCase()
        if (!['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) {
            setErrorMsg('Formato no soportado. Usa MP4, AVI, MOV, MKV o WEBM.')
            return
        }
        setArchivoNombre(file.name)
        setFase('procesando')
        setErrorMsg('')
        setImgErr(false)

        const form = new FormData()
        form.append('file', file)
        try {
            const res = await fetch(`${BASE}/api/upload-video`, { method: 'POST', body: form })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail ?? 'Error al subir')
            setJobId(data.job_id)
            pollRef.current = setInterval(() => pollStatus(data.job_id), 800)
        } catch (e) {
            setFase('error')
            setErrorMsg(e.message)
        }
    }

    const reiniciar = async () => {
        clearInterval(pollRef.current)
        if (jobId) await fetch(`${BASE}/api/upload-video/${jobId}`, { method: 'DELETE' }).catch(() => { })
        setFase('idle'); setJobId(null); setJob(null)
        setArchivoNombre(''); setErrorMsg(''); setImgErr(false)
        if (fileRef.current) fileRef.current.value = ''
    }

    const pct = job?.progreso ?? 0
    const metricas = job?.metricas ?? null
    const historial = job?.historial ?? []
    const conteo = job?.conteo_zonas ?? {}
    const completado = fase === 'completado'

    return (
        <div className={styles.layout}>

            {/* ── Cabecera ── */}
            <div className={styles.pageHead}>
                <div>
                    <h2 className={styles.pageTitle}>Análisis de video</h2>
                    <p className={styles.pageSub}>
                        Sube un archivo de video para detectar y analizar personas con YOLOv8
                    </p>
                </div>
                {fase !== 'idle' && (
                    <button className={styles.reiniciarBtn} onClick={reiniciar}>↩ Nuevo video</button>
                )}
            </div>

            {/* ── Dropzone ── */}
            {fase === 'idle' && (
                <div
                    className={`${styles.dropzone} ${dragOver ? styles.dropzoneOver : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); subirVideo(e.dataTransfer.files[0]) }}
                    onClick={() => fileRef.current?.click()}
                >
                    <input ref={fileRef} type="file" accept=".mp4,.avi,.mov,.mkv,.webm"
                        className={styles.fileInput} onChange={(e) => subirVideo(e.target.files[0])} />
                    <span className={styles.dropIcon}>🎬</span>
                    <p className={styles.dropTitle}>Arrastra tu video aquí o haz clic para seleccionar</p>
                    <p className={styles.dropSub}>MP4, AVI, MOV, MKV, WEBM</p>
                    {errorMsg && <p className={styles.dropError}>⚠ {errorMsg}</p>}
                </div>
            )}

            {/* ── Procesando / completado ── */}
            {(fase === 'procesando' || completado) && jobId && (
                <>
                    {/* ── Sección 1: Video ── */}
                    <section className={styles.section}>
                        <div className={styles.videoHeader}>
                            <span className={styles.videoNombre}>{archivoNombre}</span>
                            <span className={`${styles.estadoBadge} ${completado ? styles.estadoOk : styles.estadoProcesando}`}>
                                {completado ? '✓ Completado' : `⏳ ${pct}%`}
                            </span>
                        </div>

                        <div className={styles.videoFrame}>
                            {!imgErr ? (
                                <img
                                    key={jobId}
                                    src={`${BASE}/video/upload/${jobId}`}
                                    alt="video procesado"
                                    className={styles.videoImg}
                                    onError={() => setImgErr(true)}
                                />
                            ) : (
                                <div className={styles.videoPlaceholder}>
                                    <span>📹</span>
                                    <span>Iniciando stream…</span>
                                </div>
                            )}
                        </div>

                        {!completado && (
                            <div className={styles.progressWrap}>
                                <div className={styles.progressBar} style={{ width: `${pct}%` }} />
                                <span className={styles.progressLabel}>
                                    Frame {job?.frame_actual ?? 0} / {job?.total_frames ?? '—'} · {pct}%
                                </span>
                            </div>
                        )}
                    </section>

                    {/* ── Sección 2: KPIs en tiempo real ── */}
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Detección en tiempo real</h3>
                        <div className={styles.kpiGrid}>
                            <div className={styles.kpiCard}>
                                <span className={styles.kpiVal} style={{ color: 'var(--accent)' }}>
                                    {job?.clientes_ahora ?? 0}
                                </span>
                                <span className={styles.kpiLabel}>Personas en frame</span>
                            </div>
                            <div className={styles.kpiCard}>
                                <span className={styles.kpiVal} style={{ color: 'var(--yellow)' }}>
                                    {job?.max_clientes ?? 0}
                                </span>
                                <span className={styles.kpiLabel}>Máximo detectado</span>
                            </div>
                            {metricas && <>
                                <div className={styles.kpiCard}>
                                    <span className={styles.kpiVal} style={{ color: 'var(--green)' }}>
                                        {metricas.precision}%
                                    </span>
                                    <span className={styles.kpiLabel}>Precisión</span>
                                </div>
                                <div className={styles.kpiCard}>
                                    <span className={styles.kpiVal} style={{ color: 'var(--purple)' }}>
                                        {metricas.f1}%
                                    </span>
                                    <span className={styles.kpiLabel}>F1-Score</span>
                                </div>
                                <div className={styles.kpiCard}>
                                    <span className={styles.kpiVal} style={{ color: 'var(--green)' }}>
                                        {metricas.recall}%
                                    </span>
                                    <span className={styles.kpiLabel}>Recall</span>
                                </div>
                                <div className={styles.kpiCard}>
                                    <span className={styles.kpiVal} style={{ color: 'var(--muted)' }}>
                                        {metricas.frames_procesados?.toLocaleString()}
                                    </span>
                                    <span className={styles.kpiLabel}>Frames procesados</span>
                                </div>
                            </>}
                        </div>
                    </section>

                    {/* ── Sección 3: Distribución por zona + Permanencia ── */}
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Análisis por zona</h3>
                        <div className={styles.zonaGrid}>

                            {/* Conteo actual */}
                            <div className={styles.card}>
                                <p className={styles.cardTitle}>Distribución actual</p>
                                <div className={styles.zonaList}>
                                    {Object.entries(conteo).length > 0
                                        ? Object.entries(conteo)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([zona, cnt]) => (
                                                <div key={zona} className={styles.zonaRow}>
                                                    <span className={styles.zonaDot} style={{ background: getZonaColor(zona) }} />
                                                    <span className={styles.zonaNombre}>{zona}</span>
                                                    <div className={styles.zonaBarWrap}>
                                                        <div
                                                            className={styles.zonaBar}
                                                            style={{
                                                                width: `${Math.max((cnt / (Math.max(...Object.values(conteo), 1))) * 100, cnt > 0 ? 8 : 0)}%`,
                                                                background: getZonaColor(zona),
                                                            }}
                                                        />
                                                    </div>
                                                    <span className={styles.zonaVal}>{cnt}</span>
                                                </div>
                                            ))
                                        : <p className={styles.sinDatos}>Procesando…</p>
                                    }
                                </div>
                            </div>

                            {/* Permanencia promedio (solo al completar) */}
                            {completado && metricas?.tiempo_promedio_zona && (
                                <div className={styles.card}>
                                    <p className={styles.cardTitle}>Permanencia promedio</p>
                                    <div className={styles.zonaList}>
                                        {Object.entries(metricas.tiempo_promedio_zona)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([zona, seg]) => (
                                                <div key={zona} className={styles.zonaRow}>
                                                    <span className={styles.zonaDot} style={{ background: getZonaColor(zona) }} />
                                                    <span className={styles.zonaNombre}>{zona}</span>
                                                    <div className={styles.zonaBarWrap}>
                                                        <div
                                                            className={styles.zonaBar}
                                                            style={{
                                                                width: `${Math.max((seg / (Math.max(...Object.values(metricas.tiempo_promedio_zona), 1))) * 100, seg > 0 ? 8 : 0)}%`,
                                                                background: getZonaColor(zona),
                                                            }}
                                                        />
                                                    </div>
                                                    <span className={styles.zonaVal}>{fmtSeg(seg)}</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ── Sección 4: TP/FP/FN (solo al completar) ── */}
                    {completado && metricas && (
                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Detalle del modelo</h3>
                            <div className={styles.detalleMet}>
                                <div className={styles.detalleItem}>
                                    <span className={styles.detalleVal} style={{ color: 'var(--green)' }}>{metricas.tp.toLocaleString()}</span>
                                    <span className={styles.detalleLabel}>Verdaderos positivos</span>
                                </div>
                                <div className={styles.detalleSep} />
                                <div className={styles.detalleItem}>
                                    <span className={styles.detalleVal} style={{ color: 'var(--yellow)' }}>{metricas.fp.toLocaleString()}</span>
                                    <span className={styles.detalleLabel}>Falsos positivos</span>
                                </div>
                                <div className={styles.detalleSep} />
                                <div className={styles.detalleItem}>
                                    <span className={styles.detalleVal} style={{ color: 'var(--red)' }}>{metricas.fn.toLocaleString()}</span>
                                    <span className={styles.detalleLabel}>Falsos negativos</span>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ── Sección 5: Historial minuto a minuto (solo al completar) ── */}
                    {completado && historial.length > 0 && (
                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Flujo de personas en el video</h3>
                            <div className={styles.card}>
                                <div className={styles.histGrid}>
                                    {historial.map(({ tiempo, promedio }) => {
                                        const max = Math.max(...historial.map(h => h.promedio), 1)
                                        return (
                                            <div key={tiempo} className={styles.histItem}>
                                                <div className={styles.histBarWrap}>
                                                    <div
                                                        className={styles.histBar}
                                                        style={{ height: `${Math.max((promedio / max) * 100, 4)}%` }}
                                                    />
                                                </div>
                                                <span className={styles.histVal}>{promedio}</span>
                                                <span className={styles.histLabel}>{tiempo}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </section>
                    )}
                </>
            )}

            {/* ── Error ── */}
            {fase === 'error' && (
                <div className={styles.errorWrap}>
                    <span className={styles.errorIcon}>⚠️</span>
                    <p>{errorMsg || 'Ocurrió un error al procesar el video'}</p>
                    <button className={styles.reiniciarBtn} onClick={reiniciar}>Reintentar</button>
                </div>
            )}
        </div>
    )
}
