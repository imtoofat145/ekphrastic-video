export class ResourceAccessError extends Error {
  constructor(accessState) {
    super(accessState === 'not-found' ? 'Resource not found' : 'Resource unavailable')
    this.name = 'ResourceAccessError'
    this.accessState = accessState
  }
}

export function isResourceAccessError(err) {
  return err instanceof ResourceAccessError
}
