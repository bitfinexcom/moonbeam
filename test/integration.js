/* eslint-env mocha */

'use strict'

const server = require('../lib/moonbeam')
const { getMessage, getReq } = require('./helper')

const { promisify } = require('util')
const assert = require('assert')

const PORT = 8282
const req = getReq(PORT)

const CONF = {
  'port': 8282,
  'timeoutSec': 30,
  'dbName': 'foo',
  'mongoUrl': 'mongodb://localhost',
  'cors': {},
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

const noop = (cb) => { cb() }
const plugins = [{ name: 'db', plugin: { start: noop, stop: noop } }]

describe('integration test', () => {
  it('handles invalid data', async () => {
    const s = server(CONF, plugins)
    const listen = promisify(s.listen).bind(s)
    const stop = promisify(s.stop).bind(s)

    await listen()

    const msg = getMessage()
    msg[0].command = 'blerg'
    const res = await req('POST', '/history', msg)
    console.log('res', res)
    assert.strictEqual(res.error, 'ERR_INVALID_PAYLOAD')

    await stop()
  })

  it('returns the server time for the charting lib', async () => {
    const s = server(CONF, plugins)
    const listen = promisify(s.listen).bind(s)
    const stop = promisify(s.stop).bind(s)

    await listen()

    const res = await req('GET', '/time')
    assert.ok(res[0], 'field set')
    assert.ok(+res[0] > 1549637103842, 'returns timestamp')

    await stop()
  })
})
