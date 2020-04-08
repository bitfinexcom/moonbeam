'use strict'

const fs = require('fs')
const express = require('express')
const _cors = require('cors')
const helmet = require('helmet')
const async = require('async')

const RoutesPub = require('./routes-pub')
const RoutesPrv = require('./routes-priv')

const { verifyCompetitionParams, sendGenericError } = require('./helpers/utils')
const txUtils = require('./helpers/tx-utils')
const { getSchemaValidationMw, getCaptchaMw, getValidateReguserTxMw } = require('./helpers/middlewares')
const { register } = require('./helpers/schemas')

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

    txUtils.init(conf)
  }

  startPlugins (_plugins, cb) {
    const tasks = _plugins.map((entry) => {
      return (cb) => {
        const { name, plugin } = entry
        if (this.plugins[name]) return cb(new Error('ERR_PLUGIN_PROP'))

        this.plugins[name] = plugin
        plugin.start(cb)
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
    app.use(_cors(cors))

    app.get('/competitions', pubRoutes.onCompetitionsHttpRequest.bind(pubRoutes))
    app.get('/competitions/active', pubRoutes.onActiveCompetitionHttpRequest.bind(pubRoutes))
    app.get('/competitions/:id', verifyCompetitionParams(['id']), pubRoutes.onCompetitionHttpRequest.bind(pubRoutes))
    app.get('/competitions/:id/leaderboard/:type', verifyCompetitionParams(['id', 'type']),
      pubRoutes.onCompetitionLeaderboardHttpRequest.bind(pubRoutes))

    app.get('/competitions/:id/signup', privRoutes.onCompetitionSignUpGetHttpRequest.bind(privRoutes))
    app.post('/competitions/:id/signup', privRoutes.onCompetitionSignUpSetHttpRequest.bind(privRoutes))

    app.post('/history', privRoutes.onPrivateHistoryHttpRequest.bind(privRoutes))
    app.post('/sm-tos', privRoutes.onPrivateTosMainSetHttpRequest.bind(privRoutes))
    app.post('/login', privRoutes.onPrivateLoginHttpRequest.bind(privRoutes))
    app.post('/push-tx', privRoutes.onPrivatePushTxHttpRequest.bind(privRoutes))

    app.post('/register', getSchemaValidationMw(register), getCaptchaMw(this.conf), getValidateReguserTxMw(this.conf), pubRoutes.onRegisterHttpRequest.bind(pubRoutes))

    app.get('/tos', pubRoutes.onTosHttpRequest.bind(pubRoutes))

    app.use((req, res) => {
      res.status(404).json({ error: 'Not found' })
    })

    // eslint-disable-next-line handle-callback-err
    app.use((err, req, res, next) => {
      sendGenericError(res)
    })
  }
}

function server (opts, plugins) {
  return new Moonbeam(opts, plugins)
}

module.exports = server
