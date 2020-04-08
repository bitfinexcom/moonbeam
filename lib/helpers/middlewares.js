'use strict'

const Joi = require('joi')
const axios = require('axios')
const isValidAccount = require('eos-name-verify')
const { hexToObj } = require('./tx-utils')

exports.getSchemaValidationMw = schema => (req, res, next) => {
  const _v = Joi.validate(req.body, schema)

  if (_v.error) {
    return res.status(400).json({
      error: 'ERR_INVALID_PAYLOAD',
      details: _v.error.details.map(({ message }) => message)
    })
  }

  next()
}

exports.getCaptchaMw = moonbeamConf => async (req, res, next) => {
  try {
    const { captcha } = req.body
    const { hcaptcha } = moonbeamConf
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

exports.getValidateReguserTxMw = moonbeamConf => (req, res, next) => {
  const { data: { tx: { t } } } = req.body

  try {
    const txData = hexToObj(t)
    Object.assign(req.body.data, txData)
  } catch (e) {
    const err = new Error('ERR_TX_INVALID')
    err.details = ['Wrong serialized transaction data']
    return next(err)
  }

  const aName = 'reguser'
  const perms = ['active', 'owner']
  const { data: { txObj } } = req.body
  const { actions, context_free_actions: cfa, transaction_extensions: tes } = txObj
  const { cosign } = moonbeamConf

  if (cfa.length !== 0 || tes.length !== 0) {
    return res.status(400).json({ error: 'ERR_TX_INVALID', details: ['Wrong transaction data'] })
  }

  if (actions.length !== 1) {
    return res.status(400).json({ error: 'ERR_TX_INVALID', details: ['Wrong amount of actions'] })
  }
  const action = actions[0]
  if (action.account !== cosign.account) {
    return res.status(400).json({ error: 'ERR_TX_INVALID', details: ['Wrong action account'] })
  }
  if (action.name !== aName) {
    return res.status(400).json({ error: 'ERR_TX_INVALID', details: ['Wrong action name'] })
  }

  const invalidAuth = action.authorization.length !== 2 ||
    action.authorization[0].actor !== cosign.account ||
    !isValidAccount(action.authorization[1].actor)
  if (invalidAuth) {
    return res.status(400).json({ error: 'ERR_TX_INVALID', details: ['Wrong authorization'] })
  }

  const correctPermissions = action.authorization.every(el => perms.includes(el.permission))
  if (!correctPermissions) {
    return res.status(400).json({ error: 'ERR_TX_INVALID', details: ['Wrong permissions'] })
  }

  next()
}
