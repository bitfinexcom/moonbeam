'use strict'

const fs = require('fs')
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
      console.error(err.message)
    })

    this.ws.on('close', () => {
      setTimeout(() => {
        this.connecting = false
        this.connect()
      }, this.conf.retryAfter || 2000)
    })

    this.connecting = false
    this.listenerRegistered = false
  }

  connect (cb = () => {}) {
    if (this.connecting) return

    this.connecting = true

    if (!this.listenerRegistered) {
      this.ws.on('open', () => {
        this.connecting = false
        cb()
      })
    }

    this.listenerRegistered = true

    const { requestTimeout } = this.conf
    this.ws.open()

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
    const { port, socket } = this.conf
    if (port && socket) throw new Error('ERR_SOCK_PORT')

    this.startPlugins(this._plugins, (err) => {
      if (err) return cb(err)

      if (socket) return this.listenSocket(socket, cb)

      this.server = app.listen(port, cb)
    })
  }

  listenSocket (socket, cb) {
    fs.unlink(socket, (err) => {
      if (err && err.code !== 'ENOENT') return cb(err)
      this.server = app.listen(socket, (err) => {
        if (err) return cb(err)
        fs.chmod(socket, 0o777, (err) => {
          if (err) return cb(err)
          cb(null)
        })
      })
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
    const { cors } = this.conf

    app.use((req, res, cb) => {
      if (cors['Access-Control-Allow-Origin']) {
        res.header(
          'Access-Control-Allow-Origin',
          cors['Access-Control-Allow-Origin']
        )
      }

      if (cors['Access-Control-Allow-Headers']) {
        res.header(
          'Access-Control-Allow-Headers',
          cors['Access-Control-Allow-Headers']
        )
      }

      cb()
    })

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

    const reqId = uuid()
    this.verify(reqId, payload, (err, vres) => {
      if (err) {
        log(err)

        if (err.message === 'ERR_TIMEOUT') {
          return res.status(500).json({ error: 'ERR_TIMEOUT' })
        }

        if (err.message === 'WebSocket is not open: readyState 3 (CLOSED)') {
          return res.status(500).json({ error: 'ERR_WS_DOWN' })
        }

        return sendGenericError()
      }

      const [ meta, valid ] = vres
      if (!valid) {
        return res.status(403).json({ error: 'ERR_INVALID_PAYLOAD' })
      }

      const limit = Math.min(payload.limit, maxResults)
      const user = meta.actions[0].authorization[0].actor
      const db = this.plugins.db
      const stmt = {
        $query: { username: user },
        $orderby: { ts: -1 }
      }

      db.collection
        .find(stmt, { limit: limit })
        .project({ 'entry': 1, _id: 0 })
        .toArray((err, entries) => {
          if (err) return sendGenericError()

          const cleaned = entries.map((el) => {
            return el.entry
          })

          return res.status(200).json(cleaned)
        })
    })
  }
}

function server (opts, plugins) {
  return new Moonbeam(opts, plugins)
}

module.exports = server
