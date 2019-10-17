'use strect'

const ecc = require('eosjs-ecc')

const {
  responder,
  checkPayloadByJsonSchema,
  isMtsOlderThan
} = require('./helpers')
const { SignVerificationError } = require('./errors')

class RoutesQR {
  constructor (conf, plugins, opts) {
    this.conf = conf
    this.plugins = plugins
    this.opts = opts

    this.expSec = 20 * 60
    this.redis = this.plugins.simpleWalletProtocolRedisDb
  }

  verifySign ({
    timestamp,
    sign,
    uuID,
    account,
    ref
  }) {
    if (
      timestamp &&
      sign &&
      uuID &&
      account &&
      ref &&
      typeof sign === 'string' &&
      typeof uuID === 'string' &&
      typeof account === 'string' &&
      typeof ref === 'string'
    ) {
      const data = timestamp + account + uuID + ref
      const pubkey = ecc.recover(sign, data)
      const isValid = ecc.verify(sign, data, pubkey)

      if (isValid) {
        return
      }
    }

    throw new SignVerificationError()
  }

  loginHttpRequest (req, res) {
    responder(async () => {
      const payload = req.body

      await checkPayloadByJsonSchema(
        payload,
        'loginPayload'
      )

      const {
        timestamp,
        sign,
        uuID,
        account,
        ref
      } = { ...payload }
      const data = {
        timestamp,
        sign,
        uuID,
        account,
        ref
      }

      if (isMtsOlderThan(timestamp, 2)) {
        throw new SignVerificationError()
      }

      await this.verifySign(data)
      await this.redis.hmset(uuID, data, this.expSec)

      return { success: true }
    }, res)
  }

  verifyLoginHttpRequest (req, res) {
    responder(async () => {
      const payload = req.body

      await checkPayloadByJsonSchema(
        payload,
        'verifyLoginPayload'
      )

      const { uuID } = { ...payload }

      const userData = await this.redis.hgetall(uuID)
      await this.verifySign(userData)

      const { sign } = { ...userData }

      return { sign, success: true }
    }, res)
  }
}

module.exports = RoutesQR
