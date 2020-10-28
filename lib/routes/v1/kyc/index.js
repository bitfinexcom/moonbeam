'use strict'

const axios = require('axios')
const router = require('express').Router()
const { cfHeaders = {}, kycApiUrl } = require('config')
const { getSchemaValidationMw, checkAuth, asyncMw } = require('../../../helpers/middlewares')
const { getBfxToken } = require('../../../helpers/grenache')
const { auth } = require('../../../helpers/schemas')
const { throwOnGrcErr } = require('../../../helpers/utils')
const { GenericError } = require('../../../helpers/errors')

router.post('/token/get', getSchemaValidationMw(auth), checkAuth, asyncMw(async (req, res) => {
  const { txObj } = req.body._validated.authTx
  const account = txObj.actions[0].authorization[0].actor
  const result = await getBfxToken(req, account)

  throwOnGrcErr(result, 'getBfxToken', 'ERR_USER')

  res.status(200).json({ token: result.data.apiToken })
}))

router.post('/data/get', getSchemaValidationMw(auth), checkAuth, asyncMw(async (req, res) => {
  const { txObj } = req.body._validated.authTx
  const account = txObj.actions[0].authorization[0].actor
  const result = await getBfxToken(req, account)

  throwOnGrcErr(result, 'getBfxToken', 'ERR_USER')

  const cplToken = result.data.cplToken
  if (!cplToken) {
    throw new GenericError(`grc getToken request failed: ${result.message}`)
  }

  const { data } = await axios.get(kycApiUrl, {
    headers: Object.assign({
      token: cplToken
    }, cfHeaders)
  })
    .catch(e => {
      if (e.response && e.response.data) {
        console.error('kyc api error', JSON.stringify(e.response.data, null, 2))
      }

      throw new GenericError(e.message)
    })

  res.status(200).json(data.data || {})
}))

module.exports = router
