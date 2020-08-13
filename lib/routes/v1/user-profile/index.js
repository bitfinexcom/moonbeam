'use strict'

const router = require('express').Router()
const { getSchemaValidationMw, checkAuth, asyncMw } = require('../../../helpers/middlewares')
const { userRequest } = require('../../../helpers/grenache')
const { auth, setEmail, confirmEmail } = require('../../../helpers/schemas')
const { getUserError } = require('../../../helpers/utils')

router.post('/get', getSchemaValidationMw(auth), checkAuth, asyncMw(async (req, res) => {
  const { txObj } = req.body._validated.authTx
  const account = txObj.actions[0].authorization[0].actor
  const result = await userRequest({
    action: 'getProfile',
    args: [{ account }]
  })
  if (!result.success) throw getUserError(result.message)

  res.status(200).json(result.data)
}))

router.post('/email/confirm', getSchemaValidationMw(confirmEmail), asyncMw(async (req, res) => {
  const { token } = req.body
  const result = await userRequest({
    action: 'confirmEmail',
    args: [{ token }]
  })

  if (!result.success) throw getUserError(result.message)

  res.sendStatus(204)
}))

router.post('/email/get', getSchemaValidationMw(auth), checkAuth, asyncMw(async (req, res) => {
  const { txObj } = req.body._validated.authTx
  const account = txObj.actions[0].authorization[0].actor
  const result = await userRequest({
    action: 'getEmail',
    args: [{ account }]
  })

  if (!result.success) throw getUserError(result.message)

  res.status(200).json({ value: result.data })
}))

router.post('/email/set', getSchemaValidationMw(setEmail), checkAuth, asyncMw(async (req, res) => {
  const { value: email } = req.body.data
  const { txObj } = req.body._validated.authTx
  const account = txObj.actions[0].authorization[0].actor
  const result = await userRequest({
    action: 'setEmail',
    args: [{ account, email }]
  })

  if (!result.success) throw getUserError(result.message)

  res.sendStatus(204)
}))

module.exports = router
