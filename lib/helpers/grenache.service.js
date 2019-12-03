'use strict'

const path = require('path')
process.env.EXPRESS_CONFIG_PATH = path.join(process.cwd(), 'config/grenache.service.conf.json')
const { getGrenacheReq } = require('bfx-lib-server-js/dist/express/grenacheClientService')

const tradingCompetitionRequest = ({ action, args = [{}] }, onResponse) => {
  const request = getGrenacheReq(action, args, 'rest:eosfinex:tradingcompetition')
  request({}, { json: onResponse })
}
exports.tradingCompetitionRequest = tradingCompetitionRequest
