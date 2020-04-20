'use strict'

const GenericError = require('./generic')

class ConflictError extends GenericError {
  constructor (message, { code = 'ERR_CONFLICT', details } = {}) {
    super(message, { code, details })

    this.status = 409
  }
}

module.exports = ConflictError
