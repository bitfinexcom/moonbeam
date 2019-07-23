'use strict'

const Joi = require('joi')
const uuid = require('uuid/v4')
const Sunbeam = require('sunbeam')

const schema = {
  limit: Joi.number().min(1),
  meta: Joi.object({
    actions: Joi.array().required().items(Joi.object()).single(),
    expiration: Joi.string().required()
  }).max(20).unknown(true)
}

const {
  log,
  sendGenericError
} = require('./utils')

class RoutesPriv {
  constructor (conf, plugins) {
    this.conf = conf
    this.plugins = plugins

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

module.exports = RoutesPriv
