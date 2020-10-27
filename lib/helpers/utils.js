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

exports.getCompetitionError = msg => {
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

exports.getUserError = msg => {
  switch (msg) {
    case 'ERR_ALREADY_VERIFIED':
    case 'ERR_INVALID_TOKEN':
      return new BadRequestError(`grc user err: ${msg}`, { error: msg })
    case 'ERR_NOT_FOUND':
      return new NotFoundError(`grc user err: ${msg}`, { error: msg })
    case 'ERR_EMAIL_IN_USE':
    case 'ERR_WRONG_LINK':
      return new ConflictError(`grc user err: ${msg}`, { error: msg })
    default:
      return new GenericError(`grc unknown user error: ${msg}`)
  }
}
