'use strict'

const fs = require('fs')
const express = require('express')
const _cors = require('cors')
const helmet = require('helmet')
const Joi = require('joi')
const async = require('async')
const uuid = require('uuid/v4')

const {
  sendGenericError,
  log
} = require('./utils')

const RoutesPub = require('./routes-pub')

const Sunbeam = require('sunbeam')

const app = express()
app.use(helmet())
app.use(express.json())

const schema = {
  limit: Joi.number().min(1),
  meta: Joi.object({
    actions: Joi.array().required().items(Joi.object()).single(),
    expiration: Joi.string().required()
  }).max(20).unknown(true)
}

class Moonbeam {
  constructor (conf, plugins) {
    this.conf = conf

    this._plugins = plugins

    const pubRoutes = new RoutesPub(conf, plugins)
    this.setupRoutes(pubRoutes)

    this.server = null
    this.plugins = {}

    this.ws = new Sunbeam({}, conf.sunbeam)
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

    this.ws.setMaxListeners(500)
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

    this.ws.open()

    const { requestTimeout } = this.conf
    this.websocketOpts = { requestTimeout: requestTimeout * 1000 }
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

  setupRoutes (pubRoutes) {
    const { cors } = this.conf
    const cmw = _cors(cors)

    app.options('*', cmw)

    app.post('/history', cmw, this.onPrivateHistoryHttpRequest.bind(this))

    // https://api.bitfinex.com/v2/candles/trade:1m:tBTCUSD/last
    app.get('/v2/candles/:type/last', cmw, pubRoutes.onCandlesLastHttpRequest)
    // https://api.bitfinex.com/v2/candles/trade:1m:tBTCUSD/hist
    app.get('/v2/candles/:type/hist', cmw, pubRoutes.onCandlesHistHttpRequest)
    // https://api-pub.bitfinex.com/v2/trades/tBTCUSD/hist
    app.get('/v2/trades/:symbol/hist', cmw, pubRoutes.onPublicTradesHttpRequest)

    app.get('/time', cmw, pubRoutes.onTimeHttpRequest)

    const fc = this.conf.faucet
    if (fc) {
      app.post('/faucet', cmw, pubRoutes.onFaucetRequest)
    }
  }

  verify (reqId, payload, cb) {
    this.ws
      .verifyTx(payload.meta, reqId, this.websocketOpts)
      .then((res) => {
        const [ , id, uuid, isValid ] = res

        if (id !== 'ct') {
          console.error('ERR_WRONG_MESSAGE', res)
          return cb(null, [ payload.meta, false ])
        }

        if (uuid !== reqId) {
          console.error('ERR_WRONG_UUID', uuid, reqId, res)
          return cb(null, [ payload.meta, false ])
        }

        cb(null, [ payload.meta, isValid ])
      })
      .catch((err) => {
        console.error('ERR_HISTORY', err)
        cb(err)
      })
  }

  onPrivateHistoryHttpRequest (req, res) {
    const { maxResults } = this.conf

    const payload = req.body
    const _v = Joi.validate(payload, schema)
    if (_v.error) {
      log(_v.error)
      return res.status(400).json({ error: 'ERR_INVALID_PAYLOAD' })
    }

    let reqId
    let actor
    try {
      actor = payload.meta.actions[0].authorization[0].actor
      reqId = uuid() + actor
    } catch (e) {
      log(e)
      return res.status(400).json({ error: 'ERR_INVALID_PAYLOAD' })
    }

    this.verify(reqId, payload, (err, vres) => {
      if (err) {
        log(err)

        if (err.message === 'ERR_TIMEOUT') {
          return res.status(500).json({ error: 'ERR_TIMEOUT' })
        }

        if (err.message === 'WebSocket is not open: readyState 3 (CLOSED)') {
          return res.status(500).json({ error: 'ERR_WS_DOWN' })
        }

        return sendGenericError(res)
      }

      const [ meta, valid ] = vres
      if (!valid) {
        return res.status(403).json({ error: 'ERR_INVALID_PAYLOAD' })
      }

      const limit = Math.min(payload.limit, maxResults)
      const user = meta.actions[0].authorization[0].actor
      const db = this.plugins.userDb
      const stmt = {
        $query: { username: user }
      }

      if (actor !== user) {
        log('ERR_ACTOR_USER', actor, user)
        return res.status(403).json({ error: 'ERR_INVALID_PAYLOAD' })
      }

      db.collection
        .find(stmt, { limit: limit })
        .sort({ ts: -1 })
        .project({ 'entry': 1, _id: 0 })
        .toArray((err, entries) => {
          if (err) return sendGenericError(res)

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
