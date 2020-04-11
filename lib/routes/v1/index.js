'use strict'

const router = require('express').Router()
const competitionsRouter = require('./competitions')
const usettingsRouter = require('./user-settings')
const { tosCurrent, tosCurrentDate } = require('config')
const { getSchemaValidationMw, checkAuth, verifyCaptcha, verifyReguserTx, verifyPushTx } = require('../../helpers/middlewares')
const { coSign, pushTx, checkUserSignedTos } = require('../../helpers/tx-utils')
const { register, pushTransaction, history, auth } = require('../../helpers/schemas')
const { getAuthToken, affiliatesRequest, userSettingsRequest } = require('../../helpers/grenache')
const db = require('../../helpers/db')

router.use('/competitions', competitionsRouter)
router.use('/user-settings', usettingsRouter)

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

    const result = await getAuthToken(req, user)
    if (!result.success) {
      return next(new Error('Grenache request failed: ' + result.message))
    }

    res.status(200).json({ token: result.data ? result.data : null, ok: true })
  } catch (e) {
    next(e)
  }
})

router.post('/push-tx', getSchemaValidationMw(pushTransaction), verifyPushTx, async (req, res, next) => {
  try {
    const { txArr } = req.body._validated.pushTx
    const { s } = req.body.data

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
    const { tx, settings: { affCode, email } } = req.body.data
    const { txArr, txObj } = req.body._validated.regTx
    const user = txObj.actions[0].authorization[1].actor
    const codeSrc = req.header.referer

    if (affCode) {
      const result = await affiliatesRequest({ action: 'signup', args: [{ user, code: affCode, codeSrc }] })
      if (!result.success) {
        if (result.message.startsWith('connect ECONNREFUSED') || result.message.startsWith('ERR_GRAPE_LOOKUP_EMPTY')) {
          return next(new Error('Grenache request failed: ' + result.message))
        }
        return res.status(400).json({ error: 'ERR_AFFILIATE' })
      }
    }

    const pushTxData = await coSign({
      serializedTransaction: txArr,
      signatures: [tx.s]
    })

    const txRes = await pushTx(pushTxData)
    if (txRes.error) {
      return res.status(500).json(txRes)
    }

    if (email) {
      const result = await userSettingsRequest({ action: 'setSetting', args: [user, 'email', email] })
      if (!result.success) {
        if (result.message.startsWith('connect ECONNREFUSED') || result.message.startsWith('ERR_GRAPE_LOOKUP_EMPTY')) {
          return next(new Error('Grenache request failed: ' + result.message))
        }
        return res.status(400).json({ error: 'ERR_USER_SETTINGS' })
      }
    }

    res.status(200).json(txRes)
  } catch (e) {
    next(e)
  }
})

module.exports = router
