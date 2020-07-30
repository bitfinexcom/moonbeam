'use strict'

process.env.NODE_ENV = 'test'
// fill in config/test.js
const { port, nodeHttpUrl, contract, exampleUserConfig, cosign } = require('config')

const axios = require('axios')
const fetch = require('node-fetch')
const { Api, JsonRpc, Serialize } = require('eosjs')
const { TextDecoder, TextEncoder } = require('util')
const { URL } = require('url')
const ScatterJS = require('scatterjs-core').default
const ScatterEOS = require('scatterjs-plugin-eosjs2').default
ScatterJS.plugins(new ScatterEOS())

const rpc = new JsonRpc(nodeHttpUrl, { fetch })
const req = getReq(`http://localhost:${port}`)

const opts = { blocksBehind: 3, expireSeconds: 120 }

;(async () => {
  const { pubKey, user } = exampleUserConfig
  const { api } = await getClient(exampleUserConfig, rpc)

  console.log('creating auth transaction')
  const authTxPayload = await getAuthTxPayload(api, user)

  console.log('creating usertos transaction')
  const tosPayload = await getTosTxPayload(api, user)

  console.log('creating withdraw transaction')
  const withdrawPayload = await getWithdrawTxPayload(api, user)

  console.log('post v1/register')
  console.log(await regUser(api, user, pubKey))

  console.log('post v1/stake-limits/get')
  console.log(await req('POST', '/v1/stake-limits/get', { auth: authTxPayload }))

  console.log('post v1/push-tx, pushing usertos transaction')
  console.log(await req('POST', '/v1/push-tx', { data: tosPayload }))

  console.log('post v1/cosign-tx, cosigning withdraw transaction')
  console.log(await req('POST', '/v1/cosign-tx', { data: withdrawPayload }))

  console.log('post v1/history')
  console.log(await req('POST', '/v1/history', {
    auth: authTxPayload,
    data: { limit: 100 }
  }))

  console.log('post v1/login')
  console.log(await req('POST', '/v1/login', { auth: authTxPayload }))

  // profile email
  console.log('post v1/user-profile/email/set')
  console.log(await req('POST', '/v1/user-profile/email/set', {
    auth: authTxPayload,
    data: { value: 'email2@examplemail.com' }
  }))

  console.log('post v1/user-profile/email/get')
  console.log(await req('POST', '/v1/user-profile/email/get', { auth: authTxPayload }))

  // console.log('post v1/user-profile/email/confirm')
  // console.log(await req('POST', '/v1/user-profile/email/confirm', { token: '<insert token here>' }))

  // user-settings
  console.log('post /v1/user-settings/email/set')
  console.log(await req('POST', '/v1/user-settings/email/set', {
    auth: authTxPayload,
    data: {
      value: 'email1@examplemail.com'
    }
  }))

  console.log('post /v1/user-settings/social_twitter/set')
  console.log(await req('POST', '/v1/user-settings/social_twitter/set', {
    auth: authTxPayload,
    data: {
      value: 'twitter_handle'
    }
  }))

  console.log('post v1/user-settings/email/get')
  console.log(await req('POST', '/v1/user-settings/email/get', { auth: authTxPayload }))

  console.log('post v1/user-settings/list/get')
  console.log(await req('POST', '/v1/user-settings/list/get', {
    auth: authTxPayload,
    data: ['social_twitter', 'email']
  }))

  // competitions
  console.log('get v1/competitions')
  console.log(await req('GET', '/v1/competitions'))

  console.log('get v1/competitions/:id')
  console.log(await req('GET', '/v1/competitions/1'))

  console.log('get v1/competitions/active')
  console.log(await req('GET', '/v1/competitions/active'))

  console.log('get v1/competitions/:id/leaderboard/vol')
  console.log(await req('GET', '/v1/competitions/1/leaderboard/vol'))

  console.log('get v1/competitions/:id/leaderboard/pnl')
  console.log(await req('GET', '/v1/competitions/1/leaderboard/pnl'))

  console.log('post v1/competitions/:id/rank/vol')
  console.log(await req('POST', '/v1/competitions/1/rank/vol', { auth: authTxPayload }))

  console.log('post v1/competitions/:id/signup/status')
  console.log(await req('POST', '/v1/competitions/1/signup/status', { auth: authTxPayload }))

  console.log('post v1/competitions/signup')
  console.log(await req('POST', '/v1/competitions/1/signup', { auth: authTxPayload }))
})()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })

async function getAuthTxPayload (api, user) {
  const authActions = [{
    account: contract,
    name: 'validate',
    authorization: [{
      actor: user,
      permission: 'active'
    }],
    data: {
      account: user
    }
  }]

  const authTxData = await api.transact({ actions: authActions }, {
    ...opts,
    broadcast: false,
    sign: true
  })

  const authTxHex = Serialize.arrayToHex(authTxData.serializedTransaction)
  return {
    t: authTxHex,
    s: authTxData.signatures[0]
  }
}

async function getTosTxPayload (api, user) {
  const tosActions = [{
    account: contract,
    name: 'validate',
    authorization: [{
      actor: cosign.duelActions.contract,
      permission: cosign.duelActions.permission
    }],
    data: {
      account: cosign.duelActions.contract
    }
  }, {
    account: contract,
    name: 'usertos',
    authorization: [{
      actor: user,
      permission: 'active'
    }],
    data: {
      account: user,
      tos: 1
    }
  }]

  const tosTxData = await api.transact({ actions: tosActions }, {
    ...opts,
    broadcast: false,
    sign: true
  })

  const tosTxHex = Serialize.arrayToHex(tosTxData.serializedTransaction)
  return {
    t: tosTxHex,
    s: tosTxData.signatures[0]
  }
}

async function getWithdrawTxPayload (api, user) {
  const withdrawActions = [{
    account: contract,
    name: 'validate',
    authorization: [{
      actor: cosign.duelActions.contract,
      permission: cosign.duelActions.permission
    }],
    data: {
      account: cosign.duelActions.contract
    }
  }, {
    account: contract,
    name: 'withdraw',
    authorization: [{
      actor: user,
      permission: 'active'
    }],
    data: {
      account: user,
      quantity: '1.00000000 USDT'
    }
  }]

  const tosTxData = await api.transact({ actions: withdrawActions }, {
    ...opts,
    broadcast: false,
    sign: true
  })

  const tosTxHex = Serialize.arrayToHex(tosTxData.serializedTransaction)
  return {
    t: tosTxHex,
    s: tosTxData.signatures[0]
  }
}

async function regUser (api, user, pubKey) {
  const regUserActions = [{
    account: contract,
    name: 'reguser',
    authorization: [{
      actor: cosign.duelAuth.contract,
      permission: cosign.duelAuth.permission
    }, {
      actor: user,
      permission: 'active'
    }],
    data: {
      account: user,
      pubkey: pubKey,
      tos: 1
    }
  }]

  const regTxData = await api.transact({ actions: regUserActions }, {
    ...opts,
    broadcast: false,
    sign: true
  })

  const regTxHex = Serialize.arrayToHex(regTxData.serializedTransaction)
  const regTxPayload = {
    t: regTxHex,
    s: regTxData.signatures[0]
  }

  const registerPayload = {
    captcha: 'captcha',
    data: {
      tx: regTxPayload,
      settings: {
        email: 'email2@examplemail.com'
      }
    }
  }
  return req('POST', '/v1/register', registerPayload)
}

function getReq (baseUrl) {
  return async function req (method, upath, payload) {
    const opts = {
      method: method,
      url: `${baseUrl}${upath}`
    }

    if (payload) {
      opts.data = payload
    }
    try {
      const { status, data } = await axios(opts)
      return { status, data }
    } catch (e) {
      const str = e.response && e.response.data && e.response.data.error
      if (!str) {
        console.error(e)
        return
      }
      return { status: e.response.status, data: e.response.data }
    }
  }
}

async function getClient (config, rpc) {
  const { useScatter, privKey, user } = config
  let signatureProvider
  if (useScatter) {
    signatureProvider = await getScatterSigner(rpc, user)
  } else {
    const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
    signatureProvider = new JsSignatureProvider([privKey])
  }

  const api = new Api({
    // use available keys to get partially signed transaction on the client side
    authorityProvider: {
      getRequiredKeys: () => signatureProvider.getAvailableKeys()
    },
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  })
  return {
    api,
    signatureProvider
  }
}

async function getScatterSigner (rpc, uAccount) {
  const { chain_id: chainId } = await rpc.get_info()
  const parsed = new URL(rpc.endpoint)
  const protocol = parsed.protocol.replace(':', '')
  const port = parsed.port || ((protocol === 'https') ? 443 : 80)

  const network = {
    blockchain: 'eos',
    protocol,
    host: parsed.hostname,
    port,
    chainId
  }

  const { scatter } = ScatterJS
  const connected = await scatter.connect('efx-demo')
  if (!connected) throw new Error('ERR_SCATTER_NOT_RUNNING')
  await scatter.forgetIdentity()
  await scatter.suggestNetwork(network)

  const hasAccount = await scatter.hasAccountFor(network)
  if (!hasAccount) {
    throw new Error('ERR_NO_SCATTER_ACCOUNT')
  }
  await scatter.getIdentity({ accounts: [network] })
  const account = scatter.identity.accounts.find(x => x.blockchain === 'eos')
  if (account.name !== uAccount) {
    throw new Error('ERR_NO_AUTHORITY')
  }
  return scatter.eosHook(network, null, true)
}
