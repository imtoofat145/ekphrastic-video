let activeMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || null

export function initGA4(measurementId) {
  const id = measurementId?.trim() || activeMeasurementId?.trim()
  if (!id || !id.startsWith('G-')) return

  activeMeasurementId = id

  if (window.gtag) {
    window.gtag('config', id)
    return
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function () {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', id)
}

export function track(eventName, payload) {
  console.log(eventName, payload)

  if (activeMeasurementId && typeof window.gtag === 'function') {
    window.gtag('event', eventName, payload)
  }
}
