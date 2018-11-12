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
  'mongoUrl': 'mongodb://localhost',
  'sunbeam': {
    'eos': {
      'Eos': () => {},
      'auth': {
        'keys': {},
        'scatter': null
      }
    }
  }
}

describe('integration test', () => {
  it('handles invalid data', async () => {
    const noop = (cb) => { cb() }
    const plugins = [{ name: 'db', plugin: { start: noop, stop: noop } }]

    const s = server(CONF, plugins)
    const listen = promisify(s.listen).bind(s)
    const stop = promisify(s.stop).bind(s)

    await listen()

    const msg = getMessage()
    msg[0].command = 'blerg'
    const res = await post(msg)
    assert.strictEqual(res.error, 'ERR_INVALID_PAYLOAD')

    await stop()
  })
})
