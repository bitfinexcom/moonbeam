'use strict'

const GenericError = require('./generic')
const ForbiddenError = require('./forbidden')
const BadRequestError = require('./bad-request')
const NotFoundError = require('./not-found')
const ConflictError = require('./conflict')

module.exports = {
  GenericError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
  NotFoundError
}
