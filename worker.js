'use strict'

const { start } = require('./lib/server')

start().catch(err => {
  console.error(err)
  process.exit(1)
})
