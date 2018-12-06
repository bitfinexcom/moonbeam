'use strict'

const argv = require('yargs').argv
const _ = require('lodash')

const conf = require('./config/moonbeam.conf.json')
const dbConf = require('./config/moonbeam.mongo.conf.json')

_.assign(conf, argv)
_.assign(dbConf, argv)

const server = require('./lib/moonbeam')
const db = require('moonbeam-mongodb')(dbConf)
const plugins = [{ name: 'db', plugin: db }]

const inst = server(conf, plugins)
inst.listen((err) => {
  if (err) throw err
  inst.connect((err) => {
    if (err) throw err
  })
})

module.exports = inst
