'use strict'

const express = require('express')
const helmet = require('helmet')

const verify = require('./verify')
const getMongoCollection = require('./mongo')

const app = express()
app.use(helmet())
app.use(express.json())

class Moonbeam {
  constructor (conf, cb) {
    this.conf = conf

    const { timeoutSec } = conf
    this.verify = verify({ timeoutSec })
    this.setupRoutes()

    this.server = null
    this.mongoClient = null
    this.collection = null
  }

  listen (cb = () => {}) {
    const { port } = this.conf

    getMongoCollection(this.conf, (err, client, coll) => {
      if (err) return cb(err)

      this.mongoClient = client
      this.collection = coll
      this.server = app.listen(port, cb)
    })
  }

  stop () {
    this.mongoClient.close()
    this.server.close()
  }

  setupRoutes () {
    app.post('/history', this.onHttpRequest.bind(this))
  }

  onHttpRequest (req, res) {
    const payload = req.body
    const valid = this.verify(payload)

    if (!valid) {
      return res.status(403).json({ error: 'ERR_INVALID_PAYLOAD' })
    }

    return res.status(200).json({ ok: true })
  }
}

function server (opts) {
  return new Moonbeam(opts)
}

module.exports = server
