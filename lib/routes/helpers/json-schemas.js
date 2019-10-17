'use strict'

const loginPayload = {
  type: 'object',
  required: [
    'protocol',
    'version',
    'timestamp',
    'sign',
    'uuID',
    'account',
    'ref'
  ],
  properties: {
    protocol: {
      type: 'string',
      const: 'SimpleWallet'
    },
    version: {
      type: 'string',
      const: '1.0'
    },
    timestamp: {
      type: 'integer'
    },
    sign: {
      type: 'string'
    },
    uuID: {
      type: 'string'
    },
    account: {
      type: 'string'
    },
    ref: {
      type: 'string'
    }
  }
}

const verifyLoginPayload = {
  type: 'object',
  required: ['uuID'],
  properties: {
    uuID: {
      type: 'string'
    }
  }
}

module.exports = {
  loginPayload,
  verifyLoginPayload
}
