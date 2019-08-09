'use strict'

const request = require('request')

exports.getReq = getReq
function getReq (port) {
  return function req (method, upath, payload) {
    return new Promise((resolve, reject) => {
      const opts = {
        method: method,
        uri: `http://localhost:${port}${upath}`,
        json: true
      }

      if (payload) {
        opts.body = payload
      }

      request(opts, (err, res, body) => {
        if (err) return reject(err)
        resolve(body)
      })
    })
  }
}
