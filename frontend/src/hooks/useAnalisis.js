import { useState, useEffect, useCallback } from 'react'

const BASE = 'http://localhost:8000'

const ESTADO_INICIAL = {
    historial: [],
    metricas: {
        precision: 0,
        recall: 0,
        f1: 0,
        tp: 0,
        fp: 0,
        fn: 0,
        frames_procesados: 0,
        tiempo_promedio_zona: {},
    },
}

export function useAnalisis(activo = false) {
    const [data, setData] = useState(ESTADO_INICIAL)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const fetchData = useCallback(async () => {
        if (!activo) return
        setLoading(true)
        try {
            const [rHist, rMet] = await Promise.all([
                fetch(`${BASE}/api/historial`),
                fetch(`${BASE}/api/metricas`),
            ])
            const hist = await rHist.json()
            const met = await rMet.json()
            setData({ historial: hist.data ?? [], metricas: met })
            setError(null)
        } catch {
            setError('No se pudo conectar con el backend')
        } finally {
            setLoading(false)
        }
    }, [activo])

    // Refresca cada 5 segundos mientras la vista está activa
    useEffect(() => {
        fetchData()
        if (!activo) return
        const id = setInterval(fetchData, 5000)
        return () => clearInterval(id)
    }, [fetchData, activo])

    return { data, loading, error, refetch: fetchData }
}
