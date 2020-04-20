'use strict'

const GenericError = require('./generic')

class ForbiddenError extends GenericError {
  constructor (message, { error = 'ERR_FORBIDDEN', details } = {}) {
    super(message, { error, details })

    this.status = 403
  }
}

module.exports = ForbiddenError
