/* eslint-env mocha */

'use strict'

const server = require('../lib/moonbeam')
const { getMessage, getPost } = require('./helper')

const { promisify } = require('util')
const assert = require('assert')

const PORT = 8282
const post = getPost(PORT)

const CONF = {
  'port': 8282,
  'timeoutSec': 30,
  'dbName': 'foo',
  'mongoUrl': 'mongodb://localhost'
}

describe('integration test', () => {
  it('handles invalid data', async () => {
    const s = server(CONF)
    const listen = promisify(s.listen).bind(s)
    await listen()

    const msg = getMessage()
    msg[0].command = 'blerg'
    const res = await post(msg)
    assert.strictEqual(res.error, 'ERR_INVALID_PAYLOAD')
    s.stop()
  })
})
