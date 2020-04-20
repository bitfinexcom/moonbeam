'use strict'

class GenericError extends Error {
  constructor (message, { code = 'ERR_GENERIC', details } = {}) {
    super(message)

    this.status = 500
    this.code = code

    if (details) {
      this.details = details
    }

    Error.captureStackTrace(this)
  }

  toJsonResponse () {
    const result = { error: this.code }
    if (this.details) {
      result.details = this.details
    }
    return result
  }
}

module.exports = GenericError
