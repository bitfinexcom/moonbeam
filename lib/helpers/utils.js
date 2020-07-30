'use strict'

const { GenericError, NotFoundError, BadRequestError, ConflictError } = require('./errors')

exports.throwOnGrcErr = (result, reqName, error) => {
  if (!result.success) {
    if (result.message.startsWith('connect ECONNREFUSED') || result.message.startsWith('ERR_GRAPE_LOOKUP_EMPTY')) {
      throw new GenericError(`grc ${reqName} failed: ${result.message}`)
    }
    throw new BadRequestError(`Couldn't ${reqName}: ${result.message}`, { error })
  }
}

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
