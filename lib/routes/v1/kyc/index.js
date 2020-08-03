'use strict'

const router = require('express').Router()
const { getSchemaValidationMw, checkAuth, asyncMw } = require('../../../helpers/middlewares')
const { userRequest } = require('../../../helpers/grenache')
const { auth } = require('../../../helpers/schemas')
const { throwOnGrcErr } = require('../../../helpers/utils')

router.post('/token/get', getSchemaValidationMw(auth), checkAuth, asyncMw(async (req, res) => {
  const { txObj } = req.body._validated.authTx
  const account = txObj.actions[0].authorization[0].actor
  const result = await userRequest({
    action: 'getBfxToken',
    args: [{ account }]
  })

  throwOnGrcErr(result, 'getBfxToken', 'ERR_USER')

  res.status(200).json({ token: result.data.apiToken })
}))

module.exports = router
