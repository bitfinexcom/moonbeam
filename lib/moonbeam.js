'use strict'

const express = require('express')
const helmet = require('helmet')
const Joi = require('joi')
const async = require('async')
const uuid = require('uuid/v4')

const Sunbeam = require('sunbeam')
const Eos = require('eosjs')
const verify = require('./verify')

const app = express()
app.use(helmet())
app.use(express.json())

const schema = {
  limit: Joi.number().min(1),
  meta: Joi.object().required()
}

const log = (...args) => {
  console.error.apply(null, args)
}

class Moonbeam {
  constructor (conf, plugins) {
    this.conf = conf

    this._plugins = plugins

    const { sunbeam } = conf

    this.setupRoutes()

    this.server = null
    this.plugins = {}

    sunbeam.eos.Eos = Eos
    this.ws = new Sunbeam(sunbeam)

    this.ws.on('error', (err) => {
      console.error(err)
    })
  }

  connect (cb = () => {}) {
    const { requestTimeout } = this.conf
    this.ws.open()
    this.ws.on('open', cb)

    const vOpts = {
      requestTimeout: requestTimeout * 1000
    }
    this.verify = verify(this.ws, vOpts)
  }

  startPlugins (_plugins, cb) {
    const tasks = _plugins.map((entry) => {
      return (cb) => {
        const { name, plugin } = entry
        if (this.plugins[name]) return cb(new Error('ERR_PLUGIN_PROP'))

        this.plugins[name] = plugin
        this.plugins[name].start(cb)
      }
    })

    async.waterfall(tasks, cb)
  }

  stopPlugins (plugins, cb) {
    const tasks = Object.keys(plugins).map((k) => {
      return (cb) => {
        plugins[k].stop(cb)
      }
    })

    async.waterfall(tasks, cb)
  }

  listen (cb = () => {}) {
    const { port } = this.conf

    this.startPlugins(this._plugins, (err) => {
      if (err) return cb(err)
      this.server = app.listen(port, cb)
    })
  }

  stop (cb = () => {}) {
    const tasks = [
      (cb) => {
        this.stopPlugins(this.plugins, cb)
      },

      (cb) => {
        this.server.close(cb)
      }
    ]

    async.waterfall(tasks, cb)
  }

  setupRoutes () {
    app.post('/history', this.onHttpRequest.bind(this))
  }

  onHttpRequest (req, res) {
    const { maxResults } = this.conf

    const sendGenericError = () => {
      res.status(500).json({ error: 'ERR_GENERIC' })
    }

    const payload = req.body
    const _v = Joi.validate(payload, schema)
    if (_v.error) {
      return res.status(400).json({ error: 'ERR_INVALID_PAYLOAD' })
    }

    if (!this.ws.connected) {
      return res.status(500).json({ error: 'ERR_SUNBEAM' })
    }

    const reqId = uuid()
    this.verify(reqId, payload, (err, vres) => {
      if (err) {
        log(err)
        return sendGenericError()
      }

      const [ meta, valid ] = vres
      if (!valid) {
        return res.status(403).json({ error: 'ERR_INVALID_PAYLOAD' })
      }

      const limit = Math.min(payload.limit, maxResults)
      const user = meta.actions[0].authorization[0].actor
      const db = this.plugins.db
      const stmt = { $query: { username: user }, $orderby: { ts: -1 } }

      db.collection.find(stmt, { limit: limit }, (err, cur) => {
        if (err) return sendGenericError()

        cur.toArray((err, entries) => {
          if (err) return sendGenericError()

          return res.status(200).json(entries)
        })
      })
    })
  }
}

function server (opts, plugins) {
  return new Moonbeam(opts, plugins)
}

module.exports = server
