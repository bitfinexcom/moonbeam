'use strict'

const argv = require('yargs').argv
const _ = require('lodash')

const conf = require('./config/moonbeam.conf.json')

_.assign(conf, argv)

const server = require('./lib/moonbeam')

const dbConfUsers = require('./config/moonbeam.mongo.conf.json')
const dbUsers = require('moonbeam-mongodb')(dbConfUsers)

const dbConfPublicTrades = require('./config/mongo.pubtrades.conf.json')
const dbPublicTrades = require('moonbeam-mongodb')(dbConfPublicTrades)

const grenacheService = require('./lib/helpers/grenache-service')

const plugins = [
  { name: 'userDb', plugin: dbUsers },
  { name: 'publicTradesDb', plugin: dbPublicTrades },
  { name: 'grenacheService', plugin: grenacheService }
]

const inst = server(conf, plugins)
inst.listen((err) => {
  if (err) throw err
  inst.connect((err) => {
    if (err) throw err
  })
})

module.exports = inst
