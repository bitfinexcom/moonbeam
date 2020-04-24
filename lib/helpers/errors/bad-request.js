'use strict'

const GenericError = require('./generic')

class BadRequestError extends GenericError {
  constructor (message, { error = 'ERR_BAD_REQUEST', details } = {}) {
    super(message, { error, details })

    this.status = 400
  }
}

module.exports = BadRequestError
