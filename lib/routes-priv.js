'use strict'

const Joi = require('joi')
const uuid = require('uuid/v4')
const Sunbeam = require('sunbeam')
const async = require('async')

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

const TOS = 'v1'

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

    const userDb = this.plugins.userDb
    this.tradesCollection = userDb.db.collection(userDb.conf.collection_trades)
    this.tosCollection = userDb.db.collection(userDb.conf.collection_tos)
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

  onPrivateTosSetHttpRequest (req, res) {
    this.validateUser(req, res, (err, data) => {
      if (err) {
        return this.handleAuthError(err, res)
      }

      const { actor } = data.parseReq

      const meta = data.verify.meta
      const user = meta.actions[0].authorization[0].actor
      if (actor !== user) {
        log('ERR_ACTOR_USER', actor, user)
        return res.status(403).json({ error: 'ERR_INVALID_PAYLOAD' })
      }

      const ts = Date.now()
      this.tosCollection.insertOne({
        _id: TOS + '_' + user,
        ts: ts,
        user: user
      }, (err) => {
        if (err && err.code === 11000) {
          return res.status(200).json({ ok: true })
        }

        if (err) {
          log(err)
          return sendGenericError(res)
        }

        return res.status(200).json({ ok: true })
      })
    })
  }

  onPrivateTosGetHttpRequest (req, res) {
    this.validateUser(req, res, (err, data) => {
      if (err) {
        return this.handleAuthError(err, res)
      }

      const { actor } = data.parseReq

      const meta = data.verify.meta
      const user = meta.actions[0].authorization[0].actor
      if (actor !== user) {
        log('ERR_ACTOR_USER', actor, user)
        return res.status(403).json({ error: 'ERR_INVALID_PAYLOAD' })
      }

      const key = TOS + '_' + user
      this.tosCollection.findOne({ _id: key }, (err, data) => {
        if (err) {
          log(err)
          return sendGenericError(res)
        }

        const signed = data && data._id === key
        return res.status(200).json({ signed_tos: signed || false })
      })
    })
  }

  onPrivateHistoryHttpRequest (req, res) {
    const { maxResults } = this.conf

    this.validateUser(req, res, (err, data) => {
      if (err) {
        return this.handleAuthError(err, res)
      }

      const { actor, payload } = data.parseReq

      const meta = data.verify.meta
      const limit = Math.min(payload.limit, maxResults)
      const user = meta.actions[0].authorization[0].actor
      const stmt = { username: user }

      if (actor !== user) {
        log('ERR_ACTOR_USER', actor, user)
        return res.status(403).json({ error: 'ERR_INVALID_PAYLOAD' })
      }

      this.tradesCollection
        .find(stmt, { limit: limit })
        .sort({ ts: -1 })
        .project({ entry: 1, _id: 0 })
        .toArray((err, entries) => {
          if (err) return sendGenericError(res)

          const cleaned = entries.map((el) => {
            return el.entry
          })

          return res.status(200).json(cleaned)
        })
    })
  }

  verify (reqId, payload, cb) {
    this.ws
      .verifyTx(payload.meta, reqId, this.websocketOpts)
      .then((res) => {
        const [, id, uuid, isValid] = res

        if (id !== 'ct') {
          console.error('ERR_WRONG_MESSAGE', res)
          return cb(null, [payload.meta, false])
        }

        if (uuid !== reqId) {
          console.error('ERR_WRONG_UUID', uuid, reqId, res)
          return cb(null, [payload.meta, false])
        }

        cb(null, [payload.meta, isValid])
      })
      .catch((err) => {
        console.error('ERR_HISTORY', err)
        cb(err)
      })
  }

  parseReq (req, cb) {
    const payload = req.body
    const _v = Joi.validate(payload, schema)

    if (_v.error) {
      // log(_v.error)
      return cb(new Error('ERR_INVALID_PAYLOAD'))
    }

    let reqId
    let actor
    try {
      actor = payload.meta.actions[0].authorization[0].actor
      reqId = uuid() + actor

      return cb(null, { actor, reqId, payload })
    } catch (e) {
      // log(e)
      return cb(new Error('ERR_INVALID_PAYLOAD'))
    }
  }

  validateUser (req, res, cb) {
    async.auto({
      parseReq: (next) => {
        this.parseReq(req, next)
      },

      verify: ['parseReq', (data, next) => {
        const { reqId, payload } = data.parseReq

        this.verify(reqId, payload, (err, vres) => {
          if (err) return next(err)

          const [meta, valid] = vres
          if (!valid) {
            return next(new Error('ERR_INVALID_KEY'))
          }

          next(null, { valid, meta })
        })
      }]
    }, (err, result) => {
      if (err) return cb(err)

      cb(null, result)
    })
  }

  handleAuthError (err, res) {
    if (err.message === 'ERR_INVALID_PAYLOAD') {
      return res.status(400).json({ error: 'ERR_INVALID_PAYLOAD' })
    }

    if (err.message === 'ERR_TIMEOUT') {
      return res.status(500).json({ error: 'ERR_TIMEOUT' })
    }

    if (err.message === 'WebSocket is not open: readyState 3 (CLOSED)') {
      return res.status(500).json({ error: 'ERR_WS_DOWN' })
    }

    if (err.message === 'ERR_INVALID_KEY') {
      return res.status(403).json({ error: 'ERR_INVALID_PAYLOAD' })
    }

    log(err)

    return sendGenericError(res)
  }
}

module.exports = RoutesPriv
