'use strict'

const router = require('express').Router()
const competitionsRouter = require('./competitions')
const usettingsRouter = require('./user-settings')
const { tosCurrent, tosCurrentDate } = require('config')
const { getSchemaValidationMw, checkAuth, verifyCaptcha, verifyReguserTx, verifyPushTx, asyncMw } = require('../../helpers/middlewares')
const { coSign, pushTx, checkUserSignedTos } = require('../../helpers/tx-utils')
const { register, pushTransaction, history, auth } = require('../../helpers/schemas')
const { getAuthToken, affiliatesRequest, userSettingsRequest } = require('../../helpers/grenache')
const { ForbiddenError, GenericError, BadRequestError } = require('../../helpers/errors')
const { getCollection } = require('../../helpers/db')

router.use('/competitions', competitionsRouter)
router.use('/user-settings', usettingsRouter)

router.get('/tos', (req, res) => res.status(200).json([tosCurrent, tosCurrentDate]))

router.post('/history', getSchemaValidationMw(history), checkAuth, asyncMw(async (req, res) => {
  const { txObj } = req.body._validated.authTx
  const { limit } = req.body.data
  const user = txObj.actions[0].authorization[0].actor
  const stmt = { username: user }

  const entries = await getCollection('trades')
    .find(stmt, { limit })
    .sort({ ts: -1 })
    .project({ entry: 1, _id: 0 })
    .toArray()

  const cleaned = entries.map(({ entry }) => entry)

  res.status(200).json(cleaned)
}))

router.post('/login', getSchemaValidationMw(auth), checkAuth, asyncMw(async (req, res) => {
  const { txObj } = req.body._validated.authTx
  const user = txObj.actions[0].authorization[0].actor
  const tosSigned = await checkUserSignedTos(user)

  if (!tosSigned) {
    throw new ForbiddenError('TOS is not signed', { error: 'ERR_TOS_NOT_SIGNED' })
  }

  const result = await getAuthToken(req, user)
  if (!result.success) {
    throw new GenericError(`grc getToken request failed: ${result.message}`)
  }

  res.status(200).json({ token: result.data ? result.data : null, ok: true })
}))

router.post('/push-tx', getSchemaValidationMw(pushTransaction), verifyPushTx, asyncMw(async (req, res) => {
  const { txArr } = req.body._validated.pushTx
  const { s } = req.body.data

  const pushTxData = {
    serializedTransaction: txArr,
    signatures: [s]
  }

  const txRes = await pushTx(pushTxData)
  if (txRes.error) {
    throw new GenericError('Failed to push transaction', txRes)
  }

  res.status(200).json(txRes)
}))

router.post('/register', getSchemaValidationMw(register), asyncMw(verifyCaptcha), verifyReguserTx, asyncMw(async (req, res) => {
  const { tx, settings: { affCode, email } } = req.body.data
  const { txArr, txObj } = req.body._validated.regTx
  const user = txObj.actions[0].authorization[1].actor
  const codeSrc = req.header.referer

  if (affCode) {
    const result = await affiliatesRequest({ action: 'signup', args: [{ user, code: affCode, codeSrc }] })
    if (!result.success) {
      if (result.message.startsWith('connect ECONNREFUSED') || result.message.startsWith('ERR_GRAPE_LOOKUP_EMPTY')) {
        throw new GenericError(`grc affiliates signup failed: ${result.message}`)
      }
      throw new BadRequestError(`Couldn't signup affiliate: ${result.message}`, { error: 'ERR_AFFILIATE' })
    }
  }

  const pushTxData = await coSign({
    serializedTransaction: txArr,
    signatures: [tx.s]
  })

  const txRes = await pushTx(pushTxData)
  if (txRes.error) {
    throw new GenericError('Failed to push reguser transaction', txRes)
  }

  if (email) {
    const result = await userSettingsRequest({ action: 'setSetting', args: [user, 'email', email] })
    if (!result.success) {
      if (result.message.startsWith('connect ECONNREFUSED') || result.message.startsWith('ERR_GRAPE_LOOKUP_EMPTY')) {
        throw new GenericError(`grc setSetting request failed: ${result.message}`)
      }
      throw new BadRequestError(`Couldn't set user setting: ${result.message}`, { error: 'ERR_USER_SETTINGS' })
    }
  }

  res.status(200).json(txRes)
}))

module.exports = router
