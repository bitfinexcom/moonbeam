'use strict'

const path = require('path')
process.env.EXPRESS_CONFIG_PATH = path.join(__dirname, '../../config/grenache.service.conf.json')

const {
  getGrenacheReqWithIp,
  getGrenacheReq,
  start,
  stop
} = require('bfx-lib-server-js').grenacheClientService

const getServiceRequest = service => ({ action, args = [{}] }) => new Promise(resolve => {
  const request = getGrenacheReq(action, args, service)
  request({}, { json: resolve })
})

const getBfxToken = (req, account) => new Promise(resolve => {
  const request = getGrenacheReqWithIp('getBfxToken', 'rest:core:user')
  req.body.account = account
  request(req, { json: resolve })
})

const getAuthToken = (req, user) => new Promise(resolve => {
  const request = getGrenacheReqWithIp('getAuthToken', 'rest:core:user')
  req.body.user = user
  request(req, { json: resolve })
})

module.exports = {
  getAuthToken,
  getBfxToken,
  kycRequest: getServiceRequest('rest:core:kyc'),
  tradingCompetitionRequest: getServiceRequest('rest:eosfinex:tradingcompetition'),
  userSettingsRequest: getServiceRequest('rest:core:user:settings'),
  userRequest: getServiceRequest('rest:core:user'),
  start,
  stop
}
