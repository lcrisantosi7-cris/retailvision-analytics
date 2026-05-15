import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Genera recomendaciones automáticas basadas en los datos del sistema.
 * Esto es lo que el documento llama "toma de decisiones basada en datos".
 */
export function generarRecomendaciones(metricas, snapshot, historial) {
    const recomendaciones = []
    const zonas = metricas?.tiempo_promedio_zona ?? {}
    const conteo = snapshot?.conteo_zonas ?? {}

    // ── Zona con más tiempo de permanencia ──
    const zonaMasTiempo = Object.entries(zonas)
        .filter(([, t]) => t > 0)
        .sort((a, b) => b[1] - a[1])[0]

    if (zonaMasTiempo) {
        recomendaciones.push({
            tipo: 'positivo',
            icono: '⭐',
            titulo: `${zonaMasTiempo[0]} genera mayor permanencia`,
            detalle: `Los clientes pasan en promedio ${zonaMasTiempo[1]}s en esta zona. Considera ampliar el surtido de productos aquí para maximizar conversión.`,
        })
    }

    // ── Zona con menos visitas ──
    const zonasMenorConteo = Object.entries(conteo)
        .filter(([, c]) => c === 0 || c < 2)
        .map(([z]) => z)

    if (zonasMenorConteo.length > 0) {
        recomendaciones.push({
            tipo: 'alerta',
            icono: '⚠️',
            titulo: `Zonas con baja afluencia detectadas`,
            detalle: `${zonasMenorConteo.join(', ')} registran poca actividad. Evalúa reposicionar productos de alta rotación o mejorar la señalización hacia estas áreas.`,
        })
    }

    // ── Hora pico ──
    if (historial?.length > 0) {
        const horaPico = [...historial].sort((a, b) => b.promedio - a.promedio)[0]
        recomendaciones.push({
            tipo: 'info',
            icono: '🕐',
            titulo: `Hora pico identificada: ${horaPico.hora}`,
            detalle: `El promedio de clientes es mayor a las ${horaPico.hora} (${horaPico.promedio} clientes). Asegura personal suficiente y stock disponible en ese horario.`,
        })
    }

    // ── Confianza del modelo ──
    const precision = metricas?.precision ?? 0
    if (precision > 0 && precision < 70) {
        recomendaciones.push({
            tipo: 'alerta',
            icono: '🔍',
            titulo: 'Precisión del modelo por debajo del 70%',
            detalle: 'Verifica las condiciones de iluminación de la cámara. Una mejor iluminación mejora significativamente la detección de personas.',
        })
    } else if (precision >= 85) {
        recomendaciones.push({
            tipo: 'positivo',
            icono: '✅',
            titulo: `Modelo operando con alta precisión (${precision}%)`,
            detalle: 'Las condiciones de captura son óptimas. Los datos generados son confiables para la toma de decisiones comerciales.',
        })
    }

    // ── Zona Caja ──
    const tiempoCaja = zonas['Caja'] ?? 0
    const tiempoEntrada = zonas['Entrada'] ?? 0
    if (tiempoCaja > 0 && tiempoEntrada > 0 && tiempoCaja > tiempoEntrada * 1.5) {
        recomendaciones.push({
            tipo: 'alerta',
            icono: '🛒',
            titulo: 'Posible cuello de botella en Caja',
            detalle: `El tiempo promedio en Caja (${tiempoCaja}s) supera considerablemente al de Entrada. Considera abrir una caja adicional en horario pico.`,
        })
    }

    return recomendaciones
}

/**
 * Exporta el contenido del reporte como PDF usando html2canvas + jsPDF.
 */
export async function exportarPDF(elementId, nombreArchivo = 'reporte-retailmonitor') {
    const elemento = document.getElementById(elementId)
    if (!elemento) return

    const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = pdf.internal.pageSize.getHeight()
    const ratio = canvas.width / canvas.height
    const imgH = pdfW / ratio

    // Si el contenido es más alto que una página, paginar
    let posY = 0
    let remaining = imgH

    while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, posY === 0 ? 0 : -(imgH - remaining), pdfW, imgH)
        remaining -= pdfH
        if (remaining > 0) {
            pdf.addPage()
            posY -= pdfH
        }
    }

    const fecha = new Date().toISOString().slice(0, 10)
    pdf.save(`${nombreArchivo}-${fecha}.pdf`)
}
