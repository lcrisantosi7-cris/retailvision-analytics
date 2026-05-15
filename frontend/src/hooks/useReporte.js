import { useState, useEffect, useCallback } from 'react'

const BASE = 'http://localhost:8000'

export function useReporte(activo = false) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [lastUpdate, setLastUpdate] = useState(null)

    const fetchData = useCallback(async () => {
        if (!activo) return
        setLoading(true)
        try {
            const [rHist, rMet, rSnap] = await Promise.all([
                fetch(`${BASE}/api/historial`),
                fetch(`${BASE}/api/metricas`),
                fetch(`${BASE}/api/snapshot`),
            ])
            const hist = await rHist.json()
            const met = await rMet.json()
            const snap = await rSnap.json()

            setData({ historial: hist.data ?? [], metricas: met, snapshot: snap })
            setLastUpdate(new Date())
            setError(null)
        } catch {
            setError('No se pudo conectar con el backend')
        } finally {
            setLoading(false)
        }
    }, [activo])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    return { data, loading, error, lastUpdate, refetch: fetchData }
}
