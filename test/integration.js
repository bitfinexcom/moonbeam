/* eslint-env mocha */

'use strict'

const server = require('../lib/moonbeam')
const { getMessage, getPost } = require('./helper')

const assert = require('assert')

const PORT = 8282
const post = getPost(PORT)

describe('integration test', () => {
  it('handles invalid data', async () => {
    const { stop } = server({ timeoutSec: 30, port: PORT })

    const msg = getMessage()
    msg[0].command = 'blerg'
    const res = await post(msg)
    assert.strictEqual(res.error, 'ERR_INVALID_PAYLOAD')
    stop()
  })
})
