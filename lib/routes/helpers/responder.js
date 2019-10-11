'use strict'

const { ValidationError } = require('ajv')

const {
  SchemaFindError,
  SignVerificationError
} = require('../errors')

const send = (res, payload, status) => {
  if (status) res.status(status)

  res.json(payload)

  return res
}

const failure = (
  res,
  error = 'ERR_INTERNAL_SERVER_ERROR',
  status = 500,
  opts = {}
) => {
  const payload = {
    error,
    status,
    ...opts
  }

  return send(res, payload, status)
}

const sendErr = (res, err) => {
  if (
    err instanceof ValidationError ||
    err instanceof SchemaFindError
  ) {
    return failure(
      res,
      'ERR_INVALID_PAYLOAD',
      400
    )
  }
  if (err instanceof SignVerificationError) {
    return failure(
      res,
      err.message,
      401,
      { success: false }
    )
  }

  return failure(res)
}

module.exports = (
  handler,
  res
) => {
  try {
    const resFn = typeof handler === 'function'
      ? handler()
      : handler

    if (resFn instanceof Promise) {
      resFn
        .then((payload) => send(res, payload))
        .catch((err) => sendErr(res, err))

      return
    }

    return send(res, resFn)
  } catch (err) {
    sendErr(res, err)
  }
}
