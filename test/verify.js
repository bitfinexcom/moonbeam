/* eslint-env mocha */

'use strict'

const verify = require('../lib/verify')
const { getMessage } = require('./helper')

const assert = require('assert')

describe('verify payloads', () => {
  it('handles invalid data', () => {
    const res = verify({ timeoutSec: 30 })({ blerg: 'foo' })
    assert.strictEqual(res, false)
  })

  it('verifies signatures with public keys', () => {
    const validMsg = getMessage()

    const res = verify({ timeoutSec: 30 })(validMsg)
    assert.strictEqual(res, true)
  })

  it('rejects signatures with changed data', () => {
    const validMsg = getMessage()
    validMsg[0].command = 'foo'

    const res = verify({ timeoutSec: 30 })(validMsg)
    assert.strictEqual(res, false)
  })

  it('requires a valid timeframe', () => {
    const outdated = getMessage(Date.now() - (1000 * 31))

    const res = verify({ timeoutSec: 30 })(outdated)
    assert.strictEqual(res, false)
  })
})
