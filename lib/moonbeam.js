'use strict'

const fs = require('fs')
const express = require('express')
const _cors = require('cors')
const helmet = require('helmet')
const async = require('async')

const RoutesPub = require('./routes-pub')
const RoutesPrv = require('./routes-priv')

const app = express()
app.use(helmet())
app.use(express.json())

class Moonbeam {
  constructor (conf, plugins) {
    this.conf = conf

    this._plugins = plugins

    this.server = null
    this.plugins = {}
    this.pubRoutes = null
    this.privRoutes = null
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

  connect (cb = () => {}) {
    this.privRoutes.connect(cb)
  }

  listen (cb = () => {}) {
    const { port, socket } = this.conf
    if (port && socket) throw new Error('ERR_SOCK_PORT')

    this.startPlugins(this._plugins, (err) => {
      if (err) return cb(err)

      this.pubRoutes = new RoutesPub(this.conf, this.plugins)
      this.privRoutes = new RoutesPrv(this.conf, this.plugins)
      this.setupRoutes(this.pubRoutes, this.privRoutes)

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

  setupRoutes (pubRoutes, privRoutes) {
    const { cors } = this.conf
    const cmw = _cors(cors)

    app.options('*', cmw)

    app.post('/history', cmw, privRoutes.onPrivateHistoryHttpRequest.bind(privRoutes))

    // https://api.bitfinex.com/v2/candles/trade:1m:tBTCUSD/last
    app.get('/v2/candles/:type/last', cmw, pubRoutes.onCandlesLastHttpRequest.bind(pubRoutes))
    // https://api.bitfinex.com/v2/candles/trade:1m:tBTCUSD/hist
    app.get('/v2/candles/:type/hist', cmw, pubRoutes.onCandlesHistHttpRequest.bind(pubRoutes))
    // https://api-pub.bitfinex.com/v2/trades/tBTCUSD/hist
    app.get('/v2/trades/:symbol/hist', cmw, pubRoutes.onPublicTradesHttpRequest.bind(pubRoutes))

    app.get('/time', cmw, pubRoutes.onTimeHttpRequest.bind(pubRoutes))

    const fc = this.conf.faucet
    if (fc) {
      app.post('/faucet', cmw, pubRoutes.onFaucetRequest.bind(pubRoutes))
    }
  }
}

function server (opts, plugins) {
  return new Moonbeam(opts, plugins)
}

module.exports = server
