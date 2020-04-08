'use strict'

const moonbeamConf = require('../../config/moonbeam.conf.json')
const dbConfUsers = require('../../config/moonbeam.mongo.conf.json')
const dbConfPublicTrades = require('../../config/mongo.pubtrades.conf.json')

module.exports = {
  moonbeamConf,
  dbConfUsers,
  dbConfPublicTrades
}
