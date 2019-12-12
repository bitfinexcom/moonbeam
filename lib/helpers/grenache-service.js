'use strict'

const path = require('path')
process.env.EXPRESS_CONFIG_PATH = path.join(__dirname, '../../config/grenache.service.conf.json')
const { getGrenacheReq, start, stop } = require('bfx-lib-server-js').grenacheClientService

const tradingCompetitionRequest = ({ action, args = [{}] }, onResponse) => {
  const request = getGrenacheReq(action, args, 'rest:eosfinex:tradingcompetition')
  request({}, { json: onResponse })
}

module.exports = {
  tradingCompetitionRequest,
  start,
  stop
}
