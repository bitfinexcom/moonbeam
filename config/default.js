module.exports = {
  port: 8181,
  socket: null,

  maxResults: 1000,

  affiliatesUrl: '__AFFILIATES_API__',

  cors: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'x-csrf-token, Content-Type, Authorization, Content-Length, X-Requested-With'
  },

  tosCurrent: 1,

  nodeHttpUrl: 'http://INSERT_MAINNET_HTTP_ENDPOINT',
  contract: '__ACCOUNT__',

  cosign: {
    pKey: '__EXCHANGE_ACC_PRIVKEY__',
    contract: '__CONTRACT__',
    permission: '__PERMISSION__'
  },

  hcaptcha: {
    enabled: false,
    endpoint: 'https://hcaptcha.com/siteverify',
    secret: '__SECRET__'
  },

  dbUsers: {
    dbName: 'trades',
    mongoUrl: 'mongodb://localhost',
    collectionHistory: 'priv_history'
  }
}
