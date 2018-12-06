'use strict'

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
  const msg = {
    meta: {
      'expiration': '2018-12-06T10:58:49',
      'ref_block_num': 33627,
      'ref_block_prefix': 180599882,
      'max_net_usage_words': 0,
      'max_cpu_usage_ms': 0,
      'delay_sec': 0,
      'context_free_actions': [],
      'actions': [{
        'account': 'efinexchange',
        'name': 'validate',
        'authorization': [{ 'actor': 'testuser4321', 'permission': 'active' }],
        'data': ''
      }],
      'transaction_extensions': [],
      'signatures': ['SIG_K1_JynbyfBZpdiQGJpfSyQ27Kx3FaMVh3fiLSC8ChLthqFc4QHZXhFiRGUEENukZ78AFhAXdvxwDRfTgpjnM9sPDYpquedq5C']
    },
    limit: 50
  }

  const sig = 'foo'

  return [ msg, sig ]
}
