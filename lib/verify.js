'use strict'

function verify (ws, opts) {
  return function _verify (_uuid, payload, cb) {
    try {
      ws.verifyTx(payload.meta, _uuid, opts)
        .then((res) => {
          const [ , id, uuid, isValid ] = res

          if (id !== 'ct') return cb(null, [ payload.meta, false ])
          if (uuid !== _uuid) return cb(null, [ payload.meta, false ])

          cb(null, [ payload.meta, isValid ])
        })
        .catch(cb)
    } catch (e) {
      return cb(e)
    }
  }
}

module.exports = verify
