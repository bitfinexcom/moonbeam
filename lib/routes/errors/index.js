'use strict'

class BaseError extends Error {
  constructor (message) {
    super(message)

    this.name = this.constructor.name
    this.message = message

    Error.captureStackTrace(this, this.constructor)
  }
}

class SchemaFindError extends BaseError {
  constructor (message = 'ERR_JSON_SCHEMA_NOT_FOUND') {
    super(message)
  }
}

module.exports = {
  BaseError,
  SchemaFindError
}
