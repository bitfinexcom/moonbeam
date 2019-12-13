'use strict'

const Joi = require('joi')
const uuid = require('uuid/v4')
const Sunbeam = require('sunbeam')
const async = require('async')
const fetch = require('node-fetch')
const eosjs = require('eosjs')

const {
  getGrenacheReqWithIp,
  getGrenacheReq
} = require('bfx-lib-server-js').grenacheClientService

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
  }).required(),
  code: Joi.string()
}

const {
  log,
  sendGenericError,
  sendNotFoundError
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
      this._getTosEntry(user, (err, data) => {
        if (err) {
          log(err)
          return sendGenericError(res)
        }

        return res.status(200).json(data)
      })
    })
  }

  _signupAffiliate (req, data, cb) {
    const { code, user, codesrc } = data

    const args = [{
      user,
      code,
      codesrc
    }]

    const service = 'rest:core:affiliate'
    const request = getGrenacheReq('signup', args, service)
    request(req, {
      json: (data) => {
        if (!data.success) {
          if (data.message.startsWith('connect ECONNREFUSED') ||
            data.message.startsWith('ERR_GRAPE_LOOKUP_EMPTY')) {
            log(data)
            return cb(new Error('ERR_AFFILIATE_BACKEND'))
          }

          return cb(new Error('ERR_AFFILIATE'))
        }

        cb(null)
      }
    })
  }

  onPrivateTosMainSetHttpRequest (req, res) {
    const { v, code } = req.body

    const { tosAvailable } = this.conf
    if (!tosAvailable.includes(v)) {
      return res.status(400).json({ error: 'ERR_TOS_INVALID' })
    }

    this.validateUserMain(req, (err, data) => {
      if (err) {
        return this.handleAuthError(err, res)
      }

      const { user, v } = data
      async.auto({
        signupAffiliate: (next) => {
          if (!code) {
            return next()
          }

          this._signupAffiliate(req, {
            code,
            user,
            codesrc: req.headers.referer
          }, next)
        },

        tos: ['signupAffiliate', (_data, next) => {
          this._writeTosEntry(v, user, (err) => {
            if (err) {
              return next(err)
            }

            next()
          })
        }],
        token: ['tos', (_data, next) => {
          if (!code) {
            return next(null)
          }

          this._getAuthToken(req, user, next)
        }]
      }, (err, data) => {
        if (err) {
          log(err)
          return this.handleAuthError(err, res)
        }

        const result = { token: data.token ? data.token : null, ok: true }
        return res.status(200).json(result)
      })
    })
  }

  _getAuthToken (req, user, cb) {
    const service = 'rest:core:user'
    const request = getGrenacheReqWithIp('getAuthToken', service)

    req.body.user = user
    request(req, {
      json: (data) => {
        if (!data.success) {
          if (data.message.startsWith('connect ECONNREFUSED') ||
            data.message.startsWith('ERR_GRAPE_LOOKUP_EMPTY')) {
            log(data)
            return cb(new Error('ERR_AUTH_BACKEND'))
          }

          return cb(new Error('ERR_AUTH'))
        }

        cb(null, data.data)
      }
    })
  }

  _writeTosEntryAndReply (v, user, res) {
    this._writeTosEntry(v, user, (err) => {
      if (err) {
        log(err)
        return sendGenericError(res)
      }

      return res.status(200).json({ ok: true })
    })
  }

  _writeTosEntry (v, user, cb) {
    const ts = Date.now()
    const key = this.getTosKey(v, user)

    this.tosCollection.insertOne({
      _id: key,
      ts: ts,
      user: user
    }, (err) => {
      if (err && err.code === 11000) {
        return cb(null)
      }

      if (err) {
        return cb(err)
      }

      cb(null)
    })
  }

  _getTosEntry (user, cb) {
    const { tosCurrent } = this.conf

    const key = this.getTosKey(tosCurrent, user)
    this.tosCollection.findOne({ _id: key }, (err, data) => {
      if (err) {
        return cb(err)
      }

      const signed = data && data._id === key
      const result = {
        signed_tos: signed || false,
        v: tosCurrent
      }

      return cb(null, result)
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

      this._writeTosEntryAndReply(v, user, res)
    })
  }

  onPrivateLoginHttpRequest (req, res) {
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

      async.auto({
        tos: (next) => {
          this._getTosEntry(user, (err, data) => {
            if (err) {
              return next(err)
            }

            if (data.signed_tos !== true) {
              return next(new Error('ERR_TOS_NOT_SIGNED'))
            }

            next(null, data)
          })
        },

        token: ['tos', (_data, next) => {
          this._getAuthToken(req, user, next)
        }]
      }, (err, data) => {
        if (err) {
          log(err)
          return this.handleAuthError(err, res)
        }

        const result = { token: data.token ? data.token : null, ok: true }
        return res.status(200).json(result)
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

      this._getTosEntry(user, (err, data) => {
        if (err) {
          log(err)
          return sendGenericError(res)
        }

        return res.status(200).json(data)
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

  onCompetitionSignUpGetHttpRequest (req, res) {
    this._ensureUserEligible(req, res, data => {
      const meta = data.verify.meta
      const user = meta.actions[0].authorization[0].actor
      const id = parseInt(req.params.id, 10)
      const { tradingCompetitionRequest } = this.plugins.grenacheService

      tradingCompetitionRequest({
        action: 'getSubscription',
        args: [{ competitionId: id, userName: user }]
      }, result => {
        if (!result.success) return sendGenericError(res)
        if (!result.data || !result.data.subscription) return sendNotFoundError(res)

        res.status(200).send(result.data)
      })
    })
  }

  onCompetitionSignUpSetHttpRequest (req, res) {
    this._ensureUserEligible(req, res, data => {
      const meta = data.verify.meta
      const user = meta.actions[0].authorization[0].actor
      const id = parseInt(req.params.id, 10)
      const { tradingCompetitionRequest } = this.plugins.grenacheService

      tradingCompetitionRequest({
        action: 'addSubscription',
        args: [{ competitionId: id, userName: user }]
      }, result => {
        if (!result.success) return sendGenericError(res)

        res.status(200).send(result.data)
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

  _ensureUserEligible (req, res, onSuccess) {
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

      onSuccess(data)
    })
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
    switch (err.message) {
      case 'ERR_AFFILIATE':
      case 'ERR_TOS_NOT_SIGNED':
      case 'ERR_TOS_INVALID':
      case 'ERR_INVALID_PAYLOAD':
      case 'ERR_TX_INVALID':
        return res.status(400).json({ error: err.message })

      case 'ERR_CPU':
        return res.status(400).json({ error: 'ERR_CPU', message: err.msg })

      case 'ERR_TIMEOUT':
      case 'WebSocket is not open: readyState 3 (CLOSED)':
      case 'ERR_AUTH_BACKEND':
      case 'ERR_AFFILIATE_BACKEND':

        return res.status(400).json({ error: err.message })

      case 'ERR_INVALID_KEY':
      case 'ERR_INVALID_PERMISSION_LEVEL':
        return res.status(403).json({ error: err.message })

      default:
        log(err)
        return sendGenericError(res)
    }
  }
}

module.exports = RoutesPriv
