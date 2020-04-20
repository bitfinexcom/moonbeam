'use strict'

const GenericError = require('./generic')

class ForbiddenError extends GenericError {
  constructor (message, { code = 'ERR_FORBIDDEN', details } = {}) {
    super(message, { code, details })

    this.status = 403
  }
}

module.exports = ForbiddenError
