'use strict'

const router = require('express').Router()
const { getSchemaValidationMw, checkAuth, asyncMw } = require('../../../helpers/middlewares')
const { userSettingsRequest } = require('../../../helpers/grenache')
const { auth, setSetting, getSettings } = require('../../../helpers/schemas')
const { throwOnGrcErr } = require('../../../helpers/utils')

router.post('/list/get', getSchemaValidationMw(getSettings), checkAuth, asyncMw(async (req, res) => {
  const { data: settings } = req.body
  const { txObj } = req.body._validated.authTx
  const user = txObj.actions[0].authorization[0].actor
  const result = await userSettingsRequest({
    action: 'getSettings',
    args: [user, settings]
  })
  throwOnGrcErr(result, 'getSettings', 'ERR_USER_SETTINGS')

  res.status(200).json(result.data)
}))

router.post('/:setting/get', getSchemaValidationMw(auth), checkAuth, asyncMw(async (req, res) => {
  const { setting } = req.params
  const { txObj } = req.body._validated.authTx
  const user = txObj.actions[0].authorization[0].actor
  const result = await userSettingsRequest({
    action: 'getSetting',
    args: [user, setting]
  })

  throwOnGrcErr(result, 'getSetting', 'ERR_USER_SETTINGS')

  res.status(200).json({ value: result.data })
}))

router.post('/:setting/set', getSchemaValidationMw(setSetting), checkAuth, asyncMw(async (req, res) => {
  const { setting } = req.params
  const { value } = req.body.data
  const { txObj } = req.body._validated.authTx
  const user = txObj.actions[0].authorization[0].actor
  const result = await userSettingsRequest({
    action: 'setSetting',
    args: [user, setting, value]
  })

  throwOnGrcErr(result, 'setSetting', 'ERR_USER_SETTINGS')

  res.sendStatus(204)
}))

module.exports = router
