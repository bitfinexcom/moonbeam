'use strict'

const conf = require('./config/moonbeam.conf.json')
const server = require('./lib/moonbeam')
const inst = server(conf)

module.exports = inst
