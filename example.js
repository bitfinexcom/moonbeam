'use strict'

const { port } = require('./config/moonbeam.conf.json')
const { getMessage, getPost } = require('./test/helper')

const post = getPost(port)
;(async () => {
  const msg = getMessage()
  console.log(await post(msg))
})()
