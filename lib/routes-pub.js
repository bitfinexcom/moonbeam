'use strict'

const { Api, JsonRpc, Serialize } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const fetch = require('node-fetch')
const { TextDecoder, TextEncoder } = require('util')
const isValidAccount = require('eos-name-verify')
const request = require('request')
const axios = require('axios')

const { sendGenericError } = require('./utils')

const {
  log,
  sendNotFoundError,
  processCompetitionsError
} = require('./utils')

class RoutesPub {
  constructor (conf, plugins) {
    this.conf = conf
    this.plugins = plugins

    this.rpc = new JsonRpc(conf.verifyTxMain.httpEndpoint, { fetch })
    this.api = new Api({
      textDecoder: new TextDecoder(),
      textEncoder: new TextEncoder()
    })

    if (conf.cosign && conf.cosign.enabled) {
      this.coSignatureProvider = new JsSignatureProvider([conf.cosign.pKey])
    }
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

  async onRegisterHttpRequest (req, res) {
    try {
      const { captcha, tx, settings } = req.body
      // TODO
      //  verify input json
      // verify captcha
      const { hcaptcha, cosign } = this.conf
      if (hcaptcha && hcaptcha.enabled) {
        const { secret, endpoint } = hcaptcha
        const { data: { success } } = await axios.post(endpoint, {
          secret,
          response: captcha
        }, {
          headers: { 'Content-Type': 'application/json' }
        })
        if (!success) {
          return res.status(400).json({ error: 'ERR_BOT_SCORE' })
        }
      }
      // ======================================
      // TODO verify affiliate code
      // ======================================
      // verify reguser tx. verification process to be modified before release
      let txUintArray
      let actions
      try {
        txUintArray = Serialize.hexToUint8Array(tx.serializedTransaction)
        actions = this.api.deserializeTransaction(txUintArray).actions
      } catch (e) {
        console.error(e)
        return res.status(400).json({ error: 'ERR_TX_INVALID', _info: 'Wrong serialized transaction data' })
      }

      if (actions.length !== 1) {
        return res.status(400).json({ error: 'ERR_TX_INVALID', _info: 'Wrong amount of actions' })
      }
      const action = actions[0]
      if (action.account !== cosign.account) {
        return res.status(400).json({ error: 'ERR_TX_INVALID', _info: 'Wrong action account' })
      }
      if (action.name !== 'reguser') {
        return res.status(400).json({ error: 'ERR_TX_INVALID', _info: 'Wrong action name' })
      }
      if (action.authorization.length !== 2 || action.authorization[0].actor !== cosign.account) {
        return res.status(400).json({ error: 'ERR_TX_INVALID', _info: 'Wrong authorization' })
      }
      const correctPermissions = action.authorization.map(el => el.permission).every(el => ['active', 'owner'].includes(el))
      if (!correctPermissions) {
        return res.status(400).json({ error: 'ERR_TX_INVALID', _info: 'Wrong permissions' })
      }
      // ======================================
      // TODO ?[check email is not in use]?
      // ======================================
      // sign and push reguser tx
      const pushTxData = {
        serializedTransaction: txUintArray,
        signatures: [tx.signatures[0]]
      }

      // co-sign if the cosigner is configured, simply forward otherwise
      if (this.coSignatureProvider) {
        const [availableKeys, { chain_id: chainId }] = await Promise.all([
          this.coSignatureProvider.getAvailableKeys(),
          this.rpc.get_info()
        ])
        const signArgs = {
          chainId: chainId,
          requiredKeys: availableKeys,
          serializedTransaction: txUintArray,
          abis: []
        }
        const { signatures: [serverSignature] } = await this.coSignatureProvider.sign(signArgs)
        pushTxData.signatures.unshift(serverSignature)
      }

      try {
        const txRes = await this.rpc.push_transaction(pushTxData)
        if (!txRes.transaction_id || !txRes.processed) {
          return res.status(500).json({ error: 'ERR_INVALID_KEY' })
        }
        return res.json({ txId: txRes.transaction_id })
      } catch (e) {
        console.error(e)

        if (e.json && e.json.error && e.json.error.code === 3080004) {
          return res.status(500).json({ error: 'ERR_CPU', _info: e.message })
        }

        return res.status(500).json({ error: 'ERR_TX_INVALID', _info: e.message })
      }
      // ======================================
      // TODO set user's email
      // ======================================
      // TODO set kyc
      // ======================================
    } catch (e) {
      console.error(e)
      sendGenericError(res)
    }
  }

  onCompetitionsHttpRequest (req, res) {
    const { tradingCompetitionRequest } = this.plugins.grenacheService

    tradingCompetitionRequest({ action: 'listCompetitions' }, result => {
      if (!result.success) return processCompetitionsError(result.message, res)

      res.status(200).json(result.data)
    })
  }

  onCompetitionHttpRequest (req, res) {
    const id = parseInt(req.params.id, 10)
    const { tradingCompetitionRequest } = this.plugins.grenacheService

    tradingCompetitionRequest({ action: 'getCompetition', args: [{ competitionId: id }] }, result => {
      if (!result.success) return processCompetitionsError(result.message, res)
      if (!result.data || !result.data.competition) return sendNotFoundError(res)

      res.status(200).json(result.data)
    })
  }

  onActiveCompetitionHttpRequest (req, res) {
    const { tradingCompetitionRequest } = this.plugins.grenacheService

    tradingCompetitionRequest({ action: 'getActiveCompetition' }, result => {
      if (!result.success) return processCompetitionsError(result.message, res)
      if (!result.data || !result.data.competition) return sendNotFoundError(res)

      res.status(200).json(result.data)
    })
  }

  onCompetitionLeaderboardHttpRequest (req, res) {
    const id = parseInt(req.params.id, 10)
    const { type } = req.params
    const { tradingCompetitionRequest } = this.plugins.grenacheService

    tradingCompetitionRequest({ action: 'getCompetitionLeaderboard', args: [{ competitionId: id, type }] }, result => {
      if (!result.success) {
        return processCompetitionsError(result.message, res)
      }

      res.status(200).json(result.data)
    })
  }
}

module.exports = RoutesPub
