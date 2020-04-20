'use strict'

class GenericError extends Error {
  constructor (message, { error = 'ERR_GENERIC', details } = {}) {
    super(message)

    this.status = 500
    this.error = error

    if (details) {
      this.details = details
    }

    Error.captureStackTrace(this)
  }

  toJsonResponse () {
    const result = { error: this.error }
    if (this.details) {
      result.details = this.details
    }
    return result
  }
}

module.exports = GenericError
