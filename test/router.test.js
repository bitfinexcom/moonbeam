'use strict'

jest.mock('../lib/helpers/tx-utils', () => ({
  coSign: jest.fn().mockResolvedValue(),
  pushTx: jest.fn().mockResolvedValue(),
  checkUserSignedTos: jest.fn().mockResolvedValue(),
  getAccount: jest.fn().mockResolvedValue(),
  recoverPubKey: jest.fn().mockResolvedValue(),
  hexToObj: jest.fn().mockReturnValue(),
  parseAndVerifyTx: jest.fn().mockReturnValue()
}))

jest.mock('../lib/helpers/tx-utils', () => ({}))

jest.mock('../lib/helpers/db', () => ({
  start: jest.fn().mockResolvedValue(),
  tradesCollection: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        project: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue()
        })
      })
    })
  }
}))

jest.mock('../lib/helpers/grenache', () => ({
  getAuthToken: jest.fn().mockResolvedValue(),
  tradingCompetitionRequest: jest.fn().mockResolvedValue(),
  affiliatesRequest: jest.fn().mockResolvedValue(),
  userSettingsRequest: jest.fn().mockResolvedValue(),
  start: jest.fn().mockResolvedValue()
}))

jest.mock('eosjs-ecc', () => ({
  initialize: jest.fn().mockResolvedValue()
}))

// const db = require('../lib/helpers/db')
// const grenache = require('../lib/helpers/grenache')
// const ecc = require('eosjs-ecc')
// const server = require('../lib/server')

describe('routes tests', () => {
  it('returns the current tos', () => {
    throw new Error('not implemented')
  })
})
