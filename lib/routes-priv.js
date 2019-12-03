'use strict'

const Joi = require('joi')
const uuid = require('uuid/v4')
const Sunbeam = require('sunbeam')
const async = require('async')
const fetch = require('node-fetch')
const eosjs = require('eosjs')

const schema = {
  limit: Joi.number().min(1),
  meta: Joi.object({
    actions: Joi.array().required().items(Joi.object()).single(),
    expiration: Joi.string().required()
  }).max(20).unknown(true),
  v: [Joi.string(), Joi.number()]
}

const schemaMainTx = {
  v: Joi.number().required(),
  t: Joi.object({
    serializedTransaction: Joi.string().required(),
    signatures: Joi.array().required().items(Joi.string()).single()
  }).required()
}

const {
  log,
  sendGenericError
} = require('./utils')

class RoutesPriv {
  constructor (conf, plugins) {
    this.conf = conf
    this.plugins = plugins

    this.mainnetRpc = new eosjs.JsonRpc(conf.verifyTxMain.httpEndpoint, { fetch })

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

  getTosKey (v, user) {
    const TOS = 'v' + v

    return TOS + '_' + user
  }

  onPrivateTosMainGetHttpRequest (req, res) {
    this.validateUserMain(req, (err, data) => {
      if (err) {
        return this.handleAuthError(err, res)
      }

      const { user } = data
      this._getTosEntry(user, res)
    })
  }

  onPrivateTosMainSetHttpRequest (req, res) {
    const { v } = req.body

    const { tosAvailable } = this.conf
    if (!tosAvailable.includes(v)) {
      return res.status(400).json({ error: 'ERR_TOS_INVALID' })
    }

    this.validateUserMain(req, (err, data) => {
      if (err) {
        return this.handleAuthError(err, res)
      }

      const { user, v } = data
      this._writeTosEntry(v, user, res)
    })
  }

  _writeTosEntry (v, user, res) {
    const ts = Date.now()
    const key = this.getTosKey(v, user)

    this.tosCollection.insertOne({
      _id: key,
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
  }

  _getTosEntry (user, res) {
    const { tosCurrent } = this.conf

    const key = this.getTosKey(tosCurrent, user)
    this.tosCollection.findOne({ _id: key }, (err, data) => {
      if (err) {
        log(err)
        return sendGenericError(res)
      }

      const signed = data && data._id === key
      const result = {
        signed_tos: signed || false,
        v: tosCurrent
      }

      return res.status(200).json(result)
    })
  }

  onPrivateTosSetHttpRequest (req, res) {
    const { tosAvailable } = this.conf

    const v = req.body.v
    if (!tosAvailable.includes(v)) {
      return res.status(400).json({ error: 'ERR_TOS_INVALID' })
    }

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

      this._writeTosEntry(v, user, res)
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

      this._getTosEntry(user, res)
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

  async validateUserMain (req, cb) {
    const { verifyTxMain } = this.conf
    const rpc = this.mainnetRpc

    const payload = req.body
    const _v = Joi.validate(payload, schemaMainTx)

    if (_v.error) {
      log(_v.error)
      return cb(new Error('ERR_INVALID_PAYLOAD'))
    }

    const { t, v } = payload

    let txRes
    try {
      t.serializedTransaction = eosjs.Serialize.hexToUint8Array(t.serializedTransaction)
      txRes = await rpc.push_transaction(t)
    } catch (e) {
      log(e)

      if (e.json && e.json.error && e.json.error.code === 3080004) {
        const err = new Error('ERR_CPU')
        err.msg = e.message
        return cb(err)
      }

      return cb(new Error('ERR_TX_INVALID'))
    }

    if (!txRes.transaction_id || !txRes.processed) {
      return cb(new Error('ERR_INVALID_KEY'))
    }

    const trace = txRes.processed.action_traces[0]

    let user, permission
    try {
      user = trace.act.authorization[0].actor
      permission = trace.act.authorization[0].permission
    } catch (e) {
      return cb(new Error('ERR_INVALID_KEY'))
    }

    if (txRes.processed.action_traces.length !== 1 ||
      trace.act.account !== verifyTxMain.contract ||
      trace.act.name !== 'verify' ||
      trace.receipt.receiver !== verifyTxMain.contract ||
      trace.act.data.account !== user) {
      return cb(new Error('ERR_INVALID_KEY'))
    }

    if (!['active', 'owner'].includes(permission)) {
      return cb(new Error('ERR_INVALID_PERMISSION_LEVEL'))
    }

    return cb(null, { user, permission, v })
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
    if (err.message === 'ERR_CPU') {
      return res.status(400).json({ error: 'ERR_CPU', message: err.msg })
    }

    if (err.message === 'ERR_TX_INVALID') {
      return res.status(400).json({ error: 'ERR_TX_INVALID' })
    }

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

    if (err.message === 'ERR_INVALID_PERMISSION_LEVEL') {
      return res.status(403).json({ error: 'ERR_INVALID_PERMISSION_LEVEL' })
    }

    log(err)

    return sendGenericError(res)
  }
}

module.exports = RoutesPriv
