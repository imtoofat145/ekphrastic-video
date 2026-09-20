/**
 * Fetch with timeout and optional external AbortSignal.
 * External abort throws AbortError; timeout throws a timeout message.
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)
  const externalSignal = options.signal
  let abortedExternally = false

  const onExternalAbort = () => {
    abortedExternally = true
    timeoutController.abort()
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId)
      throw new DOMException('The operation was aborted.', 'AbortError')
    }
    externalSignal.addEventListener('abort', onExternalAbort)
  }

  try {
    const { signal: _ignored, ...rest } = options
    const response = await fetch(url, {
      ...rest,
      signal: timeoutController.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (err) {
    clearTimeout(timeoutId)
    if (err?.name === 'AbortError') {
      if (abortedExternally || externalSignal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }
      throw new Error('Request timed out. Please try again.')
    }
    throw err
  } finally {
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }
}

export function isAbortError(err) {
  return err?.name === 'AbortError'
}

export async function parseJsonSafe(response, fallbackContext = 'response') {
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error(`Invalid ${fallbackContext}: unable to parse`)
  }
  return data ?? {}
}

/**
 * Resolve download filename from Content-Disposition or fallback.
 * @param {Response|XMLHttpRequest} response
 * @param {string} fallback
 * @returns {string}
 */
export function getDownloadFilename(response, fallback = 'download') {
  if (!response) return fallback
  const header =
    response.getResponseHeader?.('Content-Disposition') ??
    response.headers?.get?.('Content-Disposition')
  if (header) {
    const match =
      header.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)["']?/i) ||
      header.match(/filename=["']?([^"'\s;]+)["']?/i)
    if (match?.[1]) {
      return decodeURIComponent(match[1].replace(/\\"/g, '"'))
    }
  }
  return fallback
}
