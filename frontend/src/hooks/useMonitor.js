import { useState, useEffect, useRef, useCallback } from 'react'

const BASE_WS = 'ws://localhost:8000'
const BASE_API = 'http://localhost:8000'

const ESTADO_INICIAL = {
    cam_id: '',
    nombre: '',
    total_clientes: 0,
    clientes: [],
    conteo_zonas: {},
    fps: 0,
    timestamp: '',
    heatmap_b64: '',
    activa: false,
}

/**
 * useMonitor(camId)
 * -----------------
 * Se conecta al WebSocket /ws/monitor/{camId} y devuelve el estado en tiempo real.
 * Si camId cambia, cierra la conexión anterior y abre una nueva.
 */
export function useMonitor(camId = 'cam_01') {
    const [data, setData] = useState(ESTADO_INICIAL)
    const [connected, setConnected] = useState(false)
    const [error, setError] = useState(null)
    const wsRef = useRef(null)
    const retryRef = useRef(null)
    const camIdRef = useRef(camId)

    const connect = useCallback((id) => {
        // Cerrar conexión previa si existe
        if (wsRef.current) {
            wsRef.current.onclose = null   // evitar retry del socket anterior
            wsRef.current.close()
        }
        clearTimeout(retryRef.current)

        const ws = new WebSocket(`${BASE_WS}/ws/monitor/${id}`)
        wsRef.current = ws

        ws.onopen = () => {
            setConnected(true)
            setError(null)
        }

        ws.onmessage = (e) => {
            try { setData(JSON.parse(e.data)) }
            catch { /* ignorar frames malformados */ }
        }

        ws.onerror = () => setError('Error de conexión con el backend')

        ws.onclose = () => {
            setConnected(false)
            // Solo reintentar si el camId no cambió
            retryRef.current = setTimeout(() => {
                if (camIdRef.current === id) connect(id)
            }, 3000)
        }
    }, [])

    // Reconectar cuando cambia la cámara seleccionada
    useEffect(() => {
        camIdRef.current = camId
        setData(ESTADO_INICIAL)
        connect(camId)
        return () => {
            clearTimeout(retryRef.current)
            if (wsRef.current) {
                wsRef.current.onclose = null
                wsRef.current.close()
            }
        }
    }, [camId, connect])

    return { data, connected, error }
}

/**
 * useCameraList()
 * ---------------
 * Obtiene la lista de cámaras disponibles desde /api/cameras.
 * Se refresca cada 5 segundos para reflejar cambios de estado.
 */
export function useCameraList() {
    const [cameras, setCameras] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchCameras = useCallback(async () => {
        try {
            const res = await fetch(`${BASE_API}/api/cameras`)
            const json = await res.json()
            setCameras(json.cameras ?? [])
            setError(null)
        } catch {
            setError('No se pudo obtener la lista de cámaras')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchCameras()
        const id = setInterval(fetchCameras, 5000)
        return () => clearInterval(id)
    }, [fetchCameras])

    return { cameras, loading, error, refetch: fetchCameras }
}
