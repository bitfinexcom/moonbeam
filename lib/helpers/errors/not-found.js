'use strict'

const GenericError = require('./generic')

class NotFoundError extends GenericError {
  constructor (message, { error = 'ERR_NOT_FOUND', details } = {}) {
    super(message, { error, details })

    this.status = 404
  }
}

module.exports = NotFoundError
