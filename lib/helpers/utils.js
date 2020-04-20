'use strict'

const { GenericError, NotFoundError, BadRequestError, ConflictError } = require('./errors')

exports.getCompetitionError = (msg, next) => {
  switch (msg) {
    case 'ERR_WRONG_TYPE':
      return new BadRequestError(`grc competitions err: ${msg}`, { error: msg })
    case 'ERR_NOT_FOUND':
      return new NotFoundError(`grc competitions err: ${msg}`, { error: msg })
    case 'ERR_COMP_COMPLETE':
    case 'ERR_COMP_INACTIVE':
    case 'ERR_NOT_READY':
      return new ConflictError(`grc competitions err: ${msg}`, { error: msg })
    default:
      return new GenericError(`grc unknown competitions error: ${msg}`)
  }
}
