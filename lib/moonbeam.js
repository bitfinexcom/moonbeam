'use strict'

const fs = require('fs')
const express = require('express')
const helmet = require('helmet')
const Joi = require('joi')
const async = require('async')
const uuid = require('uuid/v4')
const dfns = require('date-fns')

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

const dec = (n) => {
  return +n.toFixed(8)
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

    app.post('/history', this.onPrivateHistoryHttpRequest.bind(this))

    // https://api.bitfinex.com/v2/candles/trade:1m:tBTCUSD/last
    app.get('/v2/candles/:type/last', this.onCandlesLastHttpRequest.bind(this))
    // https://api.bitfinex.com/v2/candles/trade:1m:tBTCUSD/hist
    app.get('/v2/candles/:type/hist', this.onCandlesHistHttpRequest.bind(this))
  }

  isTimeFrameSupported (f) {
    return [
      '1M', '6h', '12h', '1D', '7D', '14D', '1M',
      '1m', '5m', '15m', '30m', '1h', '3h'
    ].includes(f)
  }

  checkCandlesReq (type, cb) {
    if (!type || typeof type !== 'string') {
      return cb(new Error('ERR_INVALID_PATH'))
    }

    const framePair = type.replace(/^trade:/, '')
    const [ frame, pair ] = framePair.split(':')
    if (!this.isTimeFrameSupported(frame)) {
      return cb(new Error('ERR_INVALID_TIMEFRAME'))
    }

    cb(null, [ frame, pair ])
  }

  onCandlesHistHttpRequest (req, res) {
    const type = req.params.type
    const params = req.params

    this.checkCandlesReq(type, (err, data) => {
      if (err) {
        return res.status(403).json({ error: err.message })
      }

      const nowDt = Date.now()
      const maxEnd = dfns.endOfDay(nowDt).getTime()

      const end = +params.end || maxEnd
      const start = +params.start || 1

      if (!start || !end || start >= end || end > maxEnd) {
        return res.status(403).json({ error: 'time_interval: invalid' })
      }

      const limit = Math.min(+params.limit || 120, 1000)
      const stmt = {
        $and: [
          { type: 'trade', key: type },
          { t: { $lte: end } }, { t: { $gte: start } }
        ]
      }

      const candles = this.plugins.publicTradesDb.collection
      candles
        .find(stmt, { limit: limit })
        .sort({ t: -1 })
        .toArray((err, data) => {
          if (err) {
            log(err)
            return res.status(500).json({ error: 'ERR_Q_GENERIC' })
          }

          const fentries = formatCandles(data)
          res.status(200).json(fentries)
        })
    })
  }

  onCandlesLastHttpRequest (req, res) {
    const type = req.params.type
    this.checkCandlesReq(type, (err, data) => {
      if (err) {
        return res.status(403).json({ error: err.message })
      }

      const candles = this.plugins.publicTradesDb.collection
      const stmt = {
        $query: {
          type: 'trade',
          key: type
        }
      }

      candles
        .find(stmt, { limit: 1 })
        .sort({ t: -1 })
        .toArray((err, entries) => {
          if (err) {
            log(err)
            return res.status(500).json({ error: 'ERR_Q_GENERIC' })
          }

          const fentries = formatCandles(entries)
          res.status(200).json(fentries[0])
        })
    })
  }

  onPrivateHistoryHttpRequest (req, res) {
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
      const db = this.plugins.userDb
      const stmt = {
        $query: { username: user }
      }

      db.collection
        .find(stmt, { limit: limit })
        .sort({ ts: -1 })
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

function formatCandles (candles) {
  const res = candles.map((entry) => {
    return [
      entry.t,
      dec(entry.open),
      dec(entry.close),
      dec(entry.high),
      dec(entry.low),
      entry.volume
    ]
  })

  return res
}

function server (opts, plugins) {
  return new Moonbeam(opts, plugins)
}

module.exports = server
