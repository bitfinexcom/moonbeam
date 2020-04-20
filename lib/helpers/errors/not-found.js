'use strict'

const GenericError = require('./generic')

class NotFoundError extends GenericError {
  constructor (message, { code = 'ERR_NOT_FOUND', details } = {}) {
    super(message, { code, details })

    this.status = 404
  }
}

module.exports = NotFoundError
