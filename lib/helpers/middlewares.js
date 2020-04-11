'use strict'

const axios = require('axios')
const isValidAccount = require('eos-name-verify')

const { hexToObj, getAccount, recoverPubKey, parseAndVerifyTx } = require('./tx-utils')
const { hcaptcha, contract } = require('config')

exports.getSchemaValidationMw = schema => (req, res, next) => {
  const { value, error } = schema.validate(req.body)

  if (error) {
    return res.status(400).json({
      error: 'ERR_INVALID_PAYLOAD',
      details: error.details.map(({ message }) => message)
    })
  }

  req.body = value
  next()
}

exports.checkAuth = async (req, res, next) => {
  try {
    const { t, s } = req.body.auth

    let txData
    try {
      txData = hexToObj(t)
    } catch (e) {
      const err = new Error('ERR_TX_INVALID')
      err.details = ['Wrong serialized transaction data']
      return next(err)
    }

    const { txObj } = txData
    const validTx = txObj.context_free_actions.length === 0 &&
      txObj.actions.length === 1 &&
      txObj.actions[0].account === contract &&
      txObj.actions[0].name === 'validate' &&
      txObj.actions[0].authorization.length === 1

    if (!validTx) {
      return res.status(403).json({ error: 'ERR_INVALID_AUTH' })
    }

    const { actor, permission } = txObj.actions[0].authorization[0]
    const acc = await getAccount(actor)
      .catch(e => {
        if (e.message.startsWith('unknown key')) return null

        throw e
      })

    if (!acc) return res.status(403).json({ error: 'ERR_NO_KEY' })

    const suitablePermission = acc.permissions && acc.permissions.find(({ perm_name: pName }) => pName === permission)

    if (!suitablePermission || !suitablePermission.required_auth || !suitablePermission.required_auth.keys.length) {
      return res.status(403).json({ error: 'ERR_NO_PERMISSION' })
    }

    const keys = suitablePermission.required_auth.keys.map(({ key }) => key)
    const recoveredPubKey = await recoverPubKey({ t, s })

    if (!keys.includes(recoveredPubKey)) {
      return res.status(403).json({ error: 'ERR_WRONG_KEY' })
    }

    req.body._validated = {
      authTx: { ...txData }
    }

    next()
  } catch (err) {
    next(err)
  }
}

exports.verifyCaptcha = async (req, res, next) => {
  try {
    const { captcha } = req.body
    if (hcaptcha && hcaptcha.enabled) {
      const { secret, endpoint } = hcaptcha
      const { data: { success } } = await axios.post(endpoint, {
        secret,
        response: captcha
      }, {
        headers: { 'Content-Type': 'application/json' }
      })
      if (!success) {
        return res.status(400).json({ error: 'ERR_BOT_SCORE' })
      }
    }
    next()
  } catch (e) {
    next(e)
  }
}

exports.verifyReguserTx = (req, res, next) => {
  const { tx: { t } } = req.body.data
  const supportedActions = ['reguser']

  const vRes = parseAndVerifyTx(t, supportedActions)
  if (vRes.error) {
    return res.status(400).json(vRes)
  }

  const { txData } = vRes
  const [action] = txData.txObj.actions
  const invalidAuth = action.authorization.length !== 2 ||
    action.authorization[0].actor !== contract ||
    !isValidAccount(action.authorization[1].actor)

  if (invalidAuth) {
    return { error: 'ERR_TX_INVALID', details: ['Wrong authorization'] }
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
    return res.status(400).json(vRes)
  }

  const { txData } = vRes
  const [action] = txData.txObj.actions
  const invalidAuth = action.authorization.length !== 1 ||
    !isValidAccount(action.authorization[0].actor)

  if (invalidAuth) {
    return { error: 'ERR_TX_INVALID', details: ['Wrong authorization'] }
  }

  req.body._validated = {
    pushTx: { ...txData }
  }

  next()
}
