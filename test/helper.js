'use strict'

const ecc = require('eosjs-ecc')
const request = require('request')

exports.getPost = getPost
function getPost (port) {
  return function post (payload) {
    return new Promise((resolve, reject) => {
      request({
        method: 'POST',
        uri: `http://localhost:${port}/history`,
        json: true,
        body: payload
      }, (err, res, body) => {
        if (err) return reject(err)
        resolve(body)
      })
    })
  }
}

exports.getMessage = getMessage
function getMessage (ts) {
  const priv = '5J9YKiVU3AWNkCa2zfQpj1f2NAeMQhLsYU51N8NM28J1bMnmrEQ'
  const msg = {
    'ts': ts || Date.now(), // changed ts
    'command': 'eosfinex_get_history',
    'auth': {
      'authorization': {
        'authorization': 'testuser1431@active'
      },
      'account': 'testuser1431'
    },
    'pub': 'EOS83msFTj6yv5U91KkiRxHcDZUXJkR6xwC9EjbqqwFqhFa1nxMYx'
  }

  const sig = ecc.sign(JSON.stringify(msg), priv)

  return [ msg, sig ]
}
