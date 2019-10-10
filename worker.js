'use strict'

const argv = require('yargs').argv
const _ = require('lodash')

const conf = require('./config/moonbeam.conf.json')

_.assign(conf, argv)

const server = require('./lib/moonbeam')
const { moonbeamRedisDB } = require('./plugins')

const dbConfRedis = require('./config/moonbeam.redis.conf.json')
const redisDb = moonbeamRedisDB(dbConfRedis)

const dbConfUsers = require('./config/moonbeam.mongo.conf.json')
const dbUsers = require('moonbeam-mongodb')(dbConfUsers)

const dbConfPublicTrades = require('./config/mongo.pubtrades.conf.json')
const dbPublicTrades = require('moonbeam-mongodb')(dbConfPublicTrades)

const plugins = [
  { name: 'userDb', plugin: dbUsers },
  { name: 'publicTradesDb', plugin: dbPublicTrades },
  { name: 'simpleWalletProtocolRedisDb', plugin: redisDb }
]

const inst = server(conf, plugins)
inst.listen((err) => {
  if (err) throw err
  inst.connect((err) => {
    if (err) throw err
  })
})

module.exports = inst
