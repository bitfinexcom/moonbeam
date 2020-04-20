'use strict'

const GenericError = require('./generic')

class BadRequestError extends GenericError {
  constructor (message, { code = 'ERR_BAD_REQUEST', details } = {}) {
    super(message, { code, details })

    this.status = 400
  }
}

module.exports = BadRequestError
