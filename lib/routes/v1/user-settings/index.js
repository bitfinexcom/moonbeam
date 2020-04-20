'use strict'

const router = require('express').Router()
const { getSchemaValidationMw, checkAuth, asyncMw } = require('../../../helpers/middlewares')
const { userSettingsRequest } = require('../../../helpers/grenache')
const { auth, setSetting } = require('../../../helpers/schemas')
const { GenericError, BadRequestError } = require('../../../helpers/errors')

router.post('/:setting/get', getSchemaValidationMw(auth), checkAuth, asyncMw(async (req, res) => {
  const { setting } = req.params
  const { txObj } = req.body._validated.authTx
  const user = txObj.actions[0].authorization[0].actor
  const result = await userSettingsRequest({
    action: 'getSetting',
    args: [user, setting]
  })

  if (!result.success) {
    if (result.message.startsWith('connect ECONNREFUSED') || result.message.startsWith('ERR_GRAPE_LOOKUP_EMPTY')) {
      throw new GenericError(`grc get setting failed: ${result.message}`)
    }
    throw new BadRequestError(`Couldn't get user setting: ${result.message}`, { error: 'ERR_USER_SETTINGS' })
  }

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

  if (!result.success) {
    if (result.message.startsWith('connect ECONNREFUSED') || result.message.startsWith('ERR_GRAPE_LOOKUP_EMPTY')) {
      throw new GenericError(`grc set setting failed: ${result.message}`)
    }
    throw new BadRequestError(`Couldn't set user setting: ${result.message}`, { error: 'ERR_USER_SETTINGS' })
  }

  res.sendStatus(204)
}))

module.exports = router
