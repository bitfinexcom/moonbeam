'use strict'

const express = require('express')
const helmet = require('helmet')
const async = require('async')

const verify = require('./verify')

const app = express()
app.use(helmet())
app.use(express.json())

class Moonbeam {
  constructor (conf, plugins) {
    this.conf = conf
    this._plugins = plugins

    const { timeoutSec } = conf
    this.verify = verify({ timeoutSec })
    this.setupRoutes()

    this.server = null
    this.plugins = {}
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
    const tasks = this.plugins.map((entry) => {
      return (cb) => {
        entry.stop(cb)
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
      this.stopPlugins,
      this.server.close
    ]

    async.waterfall(tasks, cb)
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

function server (opts, plugins) {
  return new Moonbeam(opts, plugins)
}

module.exports = server
