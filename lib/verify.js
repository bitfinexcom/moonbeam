'use strict'

const ecc = require('eosjs-ecc')

function verify (opts = {}) {
  if (!opts.timeoutSec) {
    throw new Error('ERR_TIMEOUT_MISSING')
  }

  const timeout = opts.timeoutSec * 1000

  return function _verify (payload) {
    try {
      const [ msg, sig ] = payload
      const { pub } = msg

      const now = Date.now()
      const maxAge = msg.ts + timeout
      if (maxAge < now) {
        return false
      }

      return ecc.verify(sig, JSON.stringify(msg), pub)
    } catch (e) {
      return false
    }
  }
}

module.exports = verify
