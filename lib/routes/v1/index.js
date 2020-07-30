'use strict'

const router = require('express').Router()
const competitionsRouter = require('./competitions')
const usettingsRouter = require('./user-settings')
const uprofileRouter = require('./user-profile')
const { getSchemaValidationMw, checkAuth, verifyCaptcha, verifyReguserTx, verifyPushTx, asyncMw } = require('../../helpers/middlewares')
const { coSign, pushTx, checkUserSignedTos } = require('../../helpers/tx-utils')
const { register, pushTransaction, history, auth } = require('../../helpers/schemas')
const { getAuthToken, userRequest } = require('../../helpers/grenache')
const { ForbiddenError, GenericError } = require('../../helpers/errors')
const { getCollection } = require('../../helpers/db')
const { throwOnGrcErr } = require('../../helpers/utils')

router.use('/competitions', competitionsRouter)
router.use('/user-settings', usettingsRouter)
router.use('/user-profile', uprofileRouter)

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

router.post('/push-tx', getSchemaValidationMw(pushTransaction), verifyPushTx(['usertos', 'transfer']), asyncMw(async (req, res) => {
  const { txArr, txObj } = req.body._validated.pushTx
  const { s } = req.body.data
  const user = txObj.actions[1].authorization[0].actor

  const result = await userRequest({ action: 'useStakeLimit', args: [{ account: user }] })
  throwOnGrcErr(result, 'useStakeLimit', 'ERR_STAKE_LIMIT')

  if (!result.data.allow) {
    throw new ForbiddenError('Staking limit has been reached', { error: 'ERR_STAKING_LIMIT_REACHED' })
  }

  const pushTxData = await coSign({
    serializedTransaction: txArr,
    signatures: [s]
  })

  const txRes = await pushTx(pushTxData)
  if (txRes.error) {
    throw new GenericError('Failed to push transaction', txRes)
  }

  res.status(200).json({
    ...txRes,
    stakeLimits: result.data.data
  })
}))

router.post('/cosign-tx', getSchemaValidationMw(pushTransaction), verifyPushTx(['withdraw']), asyncMw(async (req, res) => {
  const { txArr, txObj } = req.body._validated.pushTx
  const { s } = req.body.data
  const user = txObj.actions[1].authorization[0].actor

  const result = await userRequest({ action: 'useStakeLimit', args: [{ account: user }] })
  throwOnGrcErr(result, 'useStakeLimit', 'ERR_STAKE_LIMIT')

  if (!result.data.allow) {
    throw new ForbiddenError('Staking limit has been reached', { error: 'ERR_STAKING_LIMIT_REACHED' })
  }

  const pushTxData = await coSign({
    serializedTransaction: txArr,
    signatures: [s]
  })

  res.status(200).json({
    signature: pushTxData.signatures[0],
    stakeLimits: result.data.data
  })
}))

router.post('/register', getSchemaValidationMw(register), asyncMw(verifyCaptcha), verifyReguserTx, asyncMw(async (req, res) => {
  const { tx, settings: { email } } = req.body.data
  const { txArr, txObj } = req.body._validated.regTx
  const account = txObj.actions[0].authorization[1].actor

  const pushTxData = await coSign({
    serializedTransaction: txArr,
    signatures: [tx.s],
    cosignType: 'duelAuth'
  })

  const txRes = await pushTx(pushTxData)
  if (txRes.error) {
    throw new GenericError('Failed to push reguser transaction', txRes)
  }

  const registerResult = await userRequest({ action: 'register', args: [{ account }] })
  throwOnGrcErr(registerResult, 'register', 'ERR_CREATE_USER')

  const initStakeLimitResult = await userRequest({ action: 'initStakeLimit', args: [{ account }] })
  throwOnGrcErr(initStakeLimitResult, 'initStakeLimit', 'ERR_STAKE_LIMIT')

  if (email) {
    const setEmailResult = await userRequest({
      action: 'setEmail',
      args: [{ account, email }]
    })

    throwOnGrcErr(setEmailResult, 'setEmail', 'ERR_USER')
  }

  res.status(200).json({
    ...txRes,
    stakeLimits: initStakeLimitResult.data
  })
}))

router.post('/stake-limits/get', getSchemaValidationMw(auth), checkAuth, asyncMw(async (req, res) => {
  const { txObj } = req.body._validated.authTx
  const user = txObj.actions[0].authorization[0].actor

  const result = await userRequest({ action: 'getStakeLimit', args: [{ account: user }] })
  throwOnGrcErr(result, 'getStakeLimit', 'ERR_STAKE_LIMIT')

  res.status(200).json(result.data)
}))

module.exports = router
