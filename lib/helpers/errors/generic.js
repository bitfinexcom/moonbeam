'use strict'

class GenericError extends Error {
  constructor (message, { error = 'ERR_GENERIC', details } = {}) {
    super(message)

    this.name = this.constructor.name

    this.status = 500
    this.error = error

    if (details) {
      this.details = details
    }

    Error.captureStackTrace(this)
    this.stack = `CODE: ${this.error}, STATUS ${this.status}, ` + (this.details ? `DETAILS: ${this.details}, ` : '') + this.stack
  }

  toString () {
    return `CODE: ${this.error}, STATUS ${this.status}, ` + (this.details ? `DETAILS: ${this.details}, ` : '') + super.toString()
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
