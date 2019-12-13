'use strict'

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
