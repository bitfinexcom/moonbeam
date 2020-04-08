'use strict'

const argv = require('yargs').argv

const {
  moonbeamConf,
  dbConfUsers,
  dbConfPublicTrades
} = require('./lib/helpers/config')

Object.assign(moonbeamConf, argv)

const server = require('./lib/moonbeam')

const dbUsers = require('moonbeam-mongodb')(dbConfUsers)
const dbPublicTrades = require('moonbeam-mongodb')(dbConfPublicTrades)

const grenacheService = require('./lib/helpers/grenache-service')

const plugins = [
  { name: 'userDb', plugin: dbUsers },
  { name: 'publicTradesDb', plugin: dbPublicTrades },
  { name: 'grenacheService', plugin: grenacheService }
]

const inst = server(moonbeamConf, plugins)
inst.listen((err) => {
  if (err) throw err
  inst.connect((err) => {
    if (err) throw err
  })
})

module.exports = inst
