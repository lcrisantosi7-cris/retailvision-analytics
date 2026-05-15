import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = 'ws://localhost:8000/ws/monitor'

const ESTADO_INICIAL = {
    total_clientes: 0,
    clientes: [],
    conteo_zonas: {},
    fps: 0,
    timestamp: '',
    frame_b64: '',
    heatmap_b64: '',
}

export function useMonitor() {
    const [data, setData] = useState(ESTADO_INICIAL)
    const [connected, setConnected] = useState(false)
    const [error, setError] = useState(null)
    const wsRef = useRef(null)
    const retryRef = useRef(null)

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return

        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => {
            setConnected(true)
            setError(null)
            clearTimeout(retryRef.current)
        }

        ws.onmessage = (e) => {
            try {
                setData(JSON.parse(e.data))
            } catch { /* ignore malformed frames */ }
        }

        ws.onerror = () => setError('Error de conexión con el backend')

        ws.onclose = () => {
            setConnected(false)
            // Reintentar cada 3 segundos
            retryRef.current = setTimeout(connect, 3000)
        }
    }, [])

    useEffect(() => {
        connect()
        return () => {
            clearTimeout(retryRef.current)
            wsRef.current?.close()
        }
    }, [connect])

    return { data, connected, error }
}