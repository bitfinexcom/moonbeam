'use strict'

const express = require('express')
const helmet = require('helmet')

const _verify = require('./verify')

const app = express()
app.use(helmet())
app.use(express.json())

function server (conf) {
  const { timeoutSec, port } = conf
  const verify = _verify({ timeoutSec })

  app.post('/history', onHttpRequest)

  function onHttpRequest (req, res) {
    const payload = req.body
    const valid = verify(payload)

    if (!valid) {
      return res.status(403).json({ error: 'ERR_INVALID_PAYLOAD' })
    }

    return res.status(200).json({ ok: true })
  }

  const s = app.listen(port)
  return { stop: s.close.bind(s) }
}

module.exports = server
