'use strict'

const loginPayload = {
  type: 'object',
  required: [
    'protocol',
    'version',
    'timestamp',
    'sign',
    'uuID',
    'Account',
    'Ref'
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
    Account: {
      type: 'string'
    },
    Ref: {
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
