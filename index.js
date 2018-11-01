'use strict'

const conf = require('./config/moonbeam.conf.json')
const server = require('./lib/moonbeam')

const dbConf = require('./config/moonbeam.mongo.conf.json')
const db = require('./lib/mongo')(dbConf)
const plugins = [{ name: 'db', plugin: db }]

const inst = server(conf, plugins)
inst.listen((err) => {
  if (err) throw err
})

module.exports = inst
