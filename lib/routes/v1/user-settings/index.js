'use strict'

const router = require('express').Router()
const { getSchemaValidationMw, checkAuth } = require('../../../helpers/middlewares')
const { userSettingsRequest } = require('../../../helpers/grenache')
const { auth, setSetting } = require('../../../helpers/schemas')

router.post('/:setting/get', getSchemaValidationMw(auth),
  checkAuth, async (req, res, next) => {
    try {
      const { setting } = req.params
      const { txObj } = req.body._validated.authTx
      const user = txObj.actions[0].authorization[0].actor
      const result = await userSettingsRequest({
        action: 'getSetting',
        args: [user, setting]
      })

      if (!result.success) {
        if (result.message.startsWith('connect ECONNREFUSED') || result.message.startsWith('ERR_GRAPE_LOOKUP_EMPTY')) {
          return next(new Error('Grenache request failed: ' + result.message))
        }
        return res.status(400).json({ error: 'ERR_USER_SETTINGS' })
      }

      res.status(200).json({ value: result.data })
    } catch (e) {
      next(e)
    }
  })

router.post('/:setting/set', getSchemaValidationMw(setSetting),
  checkAuth, async (req, res, next) => {
    try {
      const { setting } = req.params
      const { value } = req.body.data
      const { txObj } = req.body._validated.authTx
      const user = txObj.actions[0].authorization[0].actor
      const result = await userSettingsRequest({
        action: 'setSetting',
        args: [user, setting, value]
      })

      if (!result.success) {
        if (result.message.startsWith('connect ECONNREFUSED') || result.message.startsWith('ERR_GRAPE_LOOKUP_EMPTY')) {
          return next(new Error('Grenache request failed: ' + result.message))
        }
        return res.status(400).json({ error: 'ERR_USER_SETTINGS' })
      }

      res.sendStatus(204)
    } catch (e) {
      next(e)
    }
  })

module.exports = router
