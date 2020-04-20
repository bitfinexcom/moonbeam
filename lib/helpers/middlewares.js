'use strict'

const axios = require('axios')
const isValidAccount = require('eos-name-verify')

const { hcaptcha, contract } = require('config')
const { hexToObj, getAccount, recoverPubKey, parseAndVerifyTx } = require('./tx-utils')
const { GenericError, ForbiddenError, BadRequestError } = require('./errors')

// mw should return promise
exports.asyncMw = mw => (req, res, next) => mw(req, res, next).catch(next)

exports.getSchemaValidationMw = (schema, unit = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[unit])

  if (error) {
    return next(new BadRequestError(error.message, {
      error: 'ERR_INVALID_PAYLOAD',
      details: error.details.map(({ message }) => message)
    }))
  }

  req[unit] = value
  next()
}

exports.checkAuth = exports.asyncMw(async (req, res, next) => {
  const { t, s } = req.body.auth

  let txData
  try {
    txData = hexToObj(t)
  } catch (e) {
    return next(new ForbiddenError('Couldn\'t deserialize transaction', {
      code: 'ERR_ATUH_INVALID',
      details: ['Wrong serialized transaction data']
    }))
  }

  const { txObj } = txData
  const validTx = txObj.context_free_actions.length === 0 &&
    txObj.actions.length === 1 &&
    txObj.actions[0].account === contract &&
    txObj.actions[0].name === 'validate' &&
    txObj.actions[0].authorization.length === 1

  if (!validTx) {
    return next(new ForbiddenError('Transaction has incorrect payload', {
      code: 'ERR_ATUH_INVALID',
      details: ['Invalid transaction data']
    }))
  }

  const { actor, permission } = txObj.actions[0].authorization[0]
  const acc = await getAccount(actor)
    .catch(e => {
      if (e.message.startsWith('unknown key')) return null

      throw e
    })

  if (!acc) {
    return next(new ForbiddenError('No account found on chain', {
      code: 'ERR_ATUH_INVALID',
      details: ['Account not found']
    }))
  }

  const suitablePermission = acc.permissions && acc.permissions.find(({ perm_name: pName }) => pName === permission)

  if (!suitablePermission || !suitablePermission.required_auth || !suitablePermission.required_auth.keys.length) {
    return next(new ForbiddenError('No suitable permission found', {
      code: 'ERR_ATUH_INVALID',
      details: ['Wrong permission']
    }))
  }

  const keys = suitablePermission.required_auth.keys.map(({ key }) => key)
  const recoveredPubKey = await recoverPubKey({ t, s })

  if (!keys.includes(recoveredPubKey)) {
    return next(new ForbiddenError('No suitable key found', {
      code: 'ERR_ATUH_INVALID',
      details: ['Wrong key']
    }))
  }

  req.body._validated = {
    authTx: { ...txData }
  }

  next()
})

exports.verifyCaptcha = async (req, res, next) => {
  if (hcaptcha && hcaptcha.enabled) {
    const { captcha } = req.body
    const { secret, endpoint } = hcaptcha
    const { data: { success } } =
      await axios.post(endpoint, `secret=${secret}&response=${captcha}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }).catch(() => ({ data: { success: false } }))

    if (!success) {
      return next(new BadRequestError('Captcha validation failed', { error: 'ERR_BOT_SCORE' }))
    }
  }
  next()
}

exports.verifyReguserTx = (req, res, next) => {
  const { tx: { t } } = req.body.data
  const supportedActions = ['reguser']

  const vRes = parseAndVerifyTx(t, supportedActions)
  if (vRes.error) {
    return next(new BadRequestError('Reguser transaction validation failed', vRes))
  }

  const { txData } = vRes
  const [action] = txData.txObj.actions
  const invalidAuth = action.authorization.length !== 2 ||
    action.authorization[0].actor !== contract ||
    !isValidAccount(action.authorization[1].actor)

  if (invalidAuth) {
    return next(new BadRequestError('Reguser transaction validation failed', {
      error: 'ERR_TX_INVALID',
      details: ['Wrong authorization']
    }))
  }

  req.body._validated = {
    regTx: { ...txData }
  }

  next()
}

exports.verifyPushTx = (req, res, next) => {
  const { t } = req.body.data
  const supportedActions = ['transfer', 'withdraw', 'usertos']

  const vRes = parseAndVerifyTx(t, supportedActions)
  if (vRes.error) {
    return next(new BadRequestError('Pushtx transaction validation failed', vRes))
  }

  const { txData } = vRes
  const [action] = txData.txObj.actions
  const invalidAuth = action.authorization.length !== 1 ||
    !isValidAccount(action.authorization[0].actor)

  if (invalidAuth) {
    return next(new BadRequestError('Pushtx transaction validation failed', {
      error: 'ERR_TX_INVALID',
      details: ['Wrong authorization']
    }))
  }

  req.body._validated = {
    pushTx: { ...txData }
  }

  next()
}

// eslint-disable-next-line handle-callback-err
exports.errorHandler = (err, req, res, next) => {
  console.error(err)
  err = err instanceof GenericError ? err : new GenericError(err.message)
  res.status(err.status)
  res.json(err.toJsonResponse())
}
