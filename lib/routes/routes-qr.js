'use strect'

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

  // TODO: need to implement
  verifySign ({
    sign,
    uuID
  }) {
    if (
      sign &&
      uuID &&
      typeof sign === 'string' &&
      typeof uuID === 'string'
    ) {
      return
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

      if (isMtsOlderThan(timestamp, 2)) {
        throw new SignVerificationError()
      }

      await this.verifySign({
        sign,
        uuID
      })
      await this.redis.hmset(uuID, {
        timestamp,
        sign,
        uuID,
        account,
        ref
      }, this.expSec)

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
      const { sign } = { ...userData }

      if (
        !sign ||
        typeof sign !== 'string'
      ) {
        throw new SignVerificationError()
      }

      return { sign, success: true }
    }, res)
  }
}

module.exports = RoutesQR
