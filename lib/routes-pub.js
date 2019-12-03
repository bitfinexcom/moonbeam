'use strict'

const { Api, JsonRpc } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const fetch = require('node-fetch')
const { TextDecoder, TextEncoder } = require('util')
const dfns = require('date-fns')
const isValidAccount = require('eos-name-verify')
const request = require('request')
const { tradingCompetitionRequest } = require('./helpers/grenache.service')

const {
  formatCandles,
  formatTrades,
  checkCandlesReq,
  log,
  sendGenericError,
  sendNotFoundError
} = require('./utils')

class RoutesPub {
  constructor (conf, plugins) {
    this.conf = conf
    this.plugins = plugins

    const fc = this.conf.faucet
    if (!fc) {
      return
    }

    const signatureProvider = new JsSignatureProvider(fc.keyProvider)
    const rpc = new JsonRpc(fc.httpEndpoint, { fetch })
    const api = new Api({
      rpc,
      signatureProvider,
      textDecoder: new TextDecoder(),
      textEncoder: new TextEncoder()
    })

    this.faucetEos = { api }
  }

  onTimeHttpRequest (req, res) {
    res.status(200).json([Date.now()])
  }

  onTosHttpRequest (req, res) {
    const { tosCurrent, tosCurrentDate } = this.conf

    res.status(200).json([tosCurrent, tosCurrentDate])
  }

  onFaucetRequest (req, res) {
    const fc = this.conf.faucet
    const user = req.body.user
    const captcha = req.body.response

    if (!isValidAccount(user)) {
      return res.status(500).json({ error: 'ERR_INVALID_USERNAME' })
    }

    const { sitesecret } = fc.hcaptcha
    const rcBody = 'secret=' + sitesecret + '&response=' + captcha
    request({
      uri: 'https://hcaptcha.com/siteverify',
      json: true,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      body: rcBody
    }, (err, _res, body) => {
      if (err) {
        log(err)
        res.status(500).json({ error: 'ERR_Q_GENERIC' })
      }

      if (body.success !== true) {
        return res.status(400).json({ error: 'ERR_BOT_SCORE' })
      }

      this._sendFaucetRequest(fc, user, res)
    })
  }

  _sendFaucetRequest (fc, user, res) {
    this.faucetEos.api.transact({
      actions: [{
        account: fc.contract,
        name: 'send',
        authorization: [{
          actor: fc.account,
          permission: 'active'
        }],
        data: {
          account: user
        }
      }]
    }, {
      blocksBehind: 3,
      expireSeconds: 30
    }).then((tx) => {
      res.status(200).json({ ok: true, tx: tx.transaction_id })
    })
      .catch((e) => {
        log(e)

        if (e.json && e.json.error && e.json.error.details &&
          e.json.error.details[0] &&
          e.json.error.details[0].message === 'assertion failure with message: Account EOX already issued') {
          // has also code 3050003
          return res.status(500).json({ error: 'ERR_EOX_ALREADY_ISSUED' })
        }

        if (e.json && e.json.error && e.json.error.code === 3050003) {
          return res.status(500).json({ error: 'ERR_USER_DOES_NOT_EXIST' })
        }

        res.status(500).json({ error: 'ERR_Q_GENERIC' })
      })
  }

  onPublicTradesHttpRequest (req, res) {
    const symbol = req.params.symbol

    const params = req.query
    const dStart = new Date(params.start || 1)
    const dEnd = new Date(params.end || Date.now())
    const limit = Math.min(+params.limit || 120, 1000)
    const sort = +params.sort || -1

    const stmt = {
      symbol: symbol,
      created_at: { $lte: dEnd, $gte: dStart }
    }

    const trades = this.plugins.publicTradesDb.db.collection('trades')
    trades
      .find(stmt)
      .limit(limit)
      .sort({ created_at: sort })
      .project({ _id: 0, section: 0, created_at: 0, pair: 0, symbol: 0 })
      .toArray((err, data) => {
        if (err) {
          log(err)
          return res.status(500).json({ error: 'ERR_Q_GENERIC' })
        }

        const fentries = formatTrades(data)
        res.status(200).json(fentries)
      })
  }

  onCandlesHistHttpRequest (req, res) {
    const type = req.params.type
    const params = req.query

    checkCandlesReq(type, (err, data) => {
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

      const limit = Math.min(+params.limit || 120, 3000)
      const stmt = {
        key: type,
        t: { $lte: end, $gte: start }
      }

      const candles = this.plugins.publicTradesDb.db.collection('candles')
      candles
        .find(stmt)
        .limit(limit)
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
    checkCandlesReq(type, (err, data) => {
      if (err) {
        return res.status(403).json({ error: err.message })
      }

      const candles = this.plugins.publicTradesDb.db.collection('candles')
      const stmt = {
        key: type
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

  onCompetitionsHttpRequest (req, res) {
    tradingCompetitionRequest({ action: 'listCompetitions' }, result => {
      if (!result.success) return sendGenericError(res)

      res.status(200).send(result.data)
    })
  }

  onCompetitionHttpRequest (req, res) {
    const id = parseInt(req.params.id, 10)
    tradingCompetitionRequest({ action: 'getCompetition', args: [{ competitionId: id }] }, result => {
      if (!result.success) return sendGenericError(res)
      if (!result.data || !result.data.competition) return sendNotFoundError(res)

      res.status(200).send(result.data)
    })
  }

  onActiveCompetitionHttpRequest (req, res) {
    tradingCompetitionRequest({ action: 'getActiveCompetition' }, result => {
      if (!result.success) return sendGenericError(res)
      if (!result.data || !result.data.competition) return sendNotFoundError(res)

      res.status(200).send(result.data)
    })
  }

  onCompetitionLeaderboardHttpRequest (req, res) {
    const id = parseInt(req.params.id, 10)
    const { type } = req.params
    tradingCompetitionRequest({ action: 'getCompetitionLeaderboard', args: [{ competitionId: id, type }] }, result => {
      if (!result.success) return sendGenericError(res)

      res.status(200).send(result.data)
    })
  }
}

module.exports = RoutesPub
