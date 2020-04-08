/* eslint-env mocha */

'use strict'

const server = require('../lib/moonbeam')
const { getReq } = require('./helper')

const { promisify } = require('util')
const assert = require('assert')

const PORT = 8282
const req = getReq(`http://localhost:${PORT}`)

const CONF = {
  port: 8282,
  timeoutSec: 30,
  tosCurrent: 1337,
  tosCurrentDate: '2019-07-24',
  verifyTxMain: {
    httpEndpoint: 'http://localhost',
    contract: 'eosfinex'
  },

  cosign: {
    httpEndpoint: 'http://localhost',
    account: 'eosfinex',
    pKey: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
  },

  hcaptcha: {
    enabled: false
  },

  mongoUrl: 'mongodb://localhost',
  cors: {},
  sunbeam: {
    urls: {
      pub: 'ws://localhost:8888'
    },
    eos: {
      Eos: () => {},
      auth: {
        keys: {},
        scatter: null
      }
    }
  }
}

const noop = (cb = () => {}) => { cb() }
const plugins = [
  {
    name: 'userDb',
    plugin: { start: noop, stop: noop, db: { collection: noop }, conf: {} }

  }
]

describe('integration test', () => {
  it('handles invalid data', async () => {
    const s = server(CONF, plugins)
    const listen = promisify(s.listen).bind(s)
    const stop = promisify(s.stop).bind(s)

    await listen()

    const msg = {
      meta: {
        expiration: '2019-04-25T15:29:41.000',
        actions: []
      }
    }
    const res = await req('POST', '/history', msg)

    assert.strictEqual(res.error, 'ERR_INVALID_PAYLOAD')

    await stop()
  })

  it('returns the current tos', async () => {
    const s = server(CONF, plugins)
    const listen = promisify(s.listen).bind(s)
    const stop = promisify(s.stop).bind(s)

    await listen()

    const res = await req('GET', '/tos')
    assert.deepStrictEqual(res, [1337, '2019-07-24'])

    await stop()
  })
})
