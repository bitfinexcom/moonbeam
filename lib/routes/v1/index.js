'use strict'

const router = require('express').Router()
const competitionsRouter = require('./competitions')
const { tosCurrent, tosCurrentDate } = require('config')
const { getSchemaValidationMw, checkAuth, verifyCaptcha, verifyReguserTx, verifyPushTx } = require('../../helpers/middlewares')
const { coSign, pushTx, checkUserSignedTos } = require('../../helpers/tx-utils')
const { register, pushTransaction, history, auth } = require('../../helpers/schemas')
const { getGrenacheReqWithIp } = require('../../helpers/grenache')
const db = require('../../helpers/db')

router.use('/competitions', competitionsRouter)

router.get('/tos', (req, res) => res.status(200).json([tosCurrent, tosCurrentDate]))

router.post('/history', getSchemaValidationMw(history), checkAuth, (req, res, next) => {
  const { txObj } = req.body._validated.authTx
  const { limit } = req.body.data
  const user = txObj.actions[0].authorization[0].actor
  const stmt = { username: user }

  db.tradesCollection
    .find(stmt, { limit })
    .sort({ ts: -1 })
    .project({ entry: 1, _id: 0 })
    .toArray((err, entries) => {
      if (err) return next(err)

      const cleaned = entries.map(({ entry }) => entry)

      return res.status(200).json(cleaned)
    })
})

router.post('/login', getSchemaValidationMw(auth), checkAuth, async (req, res, next) => {
  try {
    const { txObj } = req.body._validated.authTx
    const user = txObj.actions[0].authorization[0].actor
    const tosSigned = await checkUserSignedTos(user)
    if (!tosSigned) {
      return res.status(403).json({ error: 'ERR_TOS_NOT_SIGNED' })
    }

    const request = getGrenacheReqWithIp('getAuthToken', 'rest:core:user')

    req.body.user = user
    request(req, {
      json: data => {
        if (!data.success) {
          return next(new Error('Grenache request failed: ' + data.message))
        }

        res.status(200).json({ token: data.data ? data.data : null, ok: true })
      }
    })
  } catch (e) {
    next(e)
  }
})

router.post('/push-tx', getSchemaValidationMw(pushTransaction), verifyPushTx, async (req, res, next) => {
  try {
    const { txArr } = req.body._validated.pushTx
    const { data: { s } } = req.body

    const pushTxData = {
      serializedTransaction: txArr,
      signatures: [s]
    }

    const txRes = await pushTx(pushTxData)
    if (txRes.error) {
      return res.status(500).json(txRes)
    }

    res.status(200).json(txRes)
  } catch (e) {
    next(e)
  }
})

router.post('/register', getSchemaValidationMw(register), verifyCaptcha, verifyReguserTx, async (req, res, next) => {
  try {
    // TODO: handle settings (email, affiliate code)
    const { data: { tx } } = req.body
    const { txArr } = req.body._validated.regTx
    const pushTxData = await coSign({
      serializedTransaction: txArr,
      signatures: [tx.s]
    })

    const txRes = await pushTx(pushTxData)
    if (txRes.error) {
      return res.status(500).json(txRes)
    }

    res.status(200).json(txRes)
  } catch (e) {
    next(e)
  }
})

module.exports = router
