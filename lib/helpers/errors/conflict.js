'use strict'

const GenericError = require('./generic')

class ConflictError extends GenericError {
  constructor (message, { error = 'ERR_CONFLICT', details } = {}) {
    super(message, { error, details })

    this.status = 409
  }
}

module.exports = ConflictError
