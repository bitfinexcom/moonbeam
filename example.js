'use strict'

const eos = require('eosjs')

const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const fetch = require('node-fetch')
const { TextDecoder, TextEncoder } = require('util')

const { port, cosign } = require('./config/moonbeam.conf.json')
const { getReq } = require('./test/helper')

const config = require('./config/dev-signing-ws.config.json')
const { getSunbeam, getClient } = require('./dev-tools')

const req = getReq(port)

;(async () => {
  const { Api, JsonRpc, Serialize } = eos
  const uPrivKey = '5KM3tHLwik5q91FALSkeqSRYPa6Kk7SpQn2BVdWusGLF4pG4f4F'
  const uPubKey = 'EOS5ryJgoyweUpS5qiWPAAozgnFPp8ZTCSRi9apGiH9xD3SQVWPLh'
  const uAccount = 'testuser1111'
  const opts = {
    blocksBehind: 3,
    expireSeconds: 120
  }
  const actions = [{
    account: cosign.account,
    name: 'reguser',
    authorization: [{
      actor: cosign.account,
      permission: 'active'
    }, {
      actor: uAccount,
      permission: 'active'
    }],
    data: {
      account: uAccount,
      pubkey: uPubKey,
      tos: 1
    }
  }]
  // Client-side signing using user's pkey
  const jrpc = new JsonRpc(cosign.httpEndpoint, { fetch })
  const signatureProvider = new JsSignatureProvider([uPrivKey])
  const api = new Api({
    rpc: jrpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  })
  const requiredKeys = await api.signatureProvider.getAvailableKeys()

  const { serializedTransaction } = await api.transact({ actions }, {
    ...opts,
    broadcast: false,
    sign: false
  })
  const { chain_id: chainId } = await jrpc.get_info()
  const signArgs = {
    chainId,
    requiredKeys,
    serializedTransaction,
    abis: []
  }
  const { signatures } = await api.signatureProvider.sign(signArgs)
  const hexTx = Serialize.arrayToHex(serializedTransaction)

  console.log(await req('POST', '/register', { tx: { serializedTransaction: hexTx, signatures } }))
})()

;(async () => {
  // sidechain verify
  const sb = await getSunbeam(config)
  const meta = await sb.getSignedTx()

  const payload = {
    meta
  }

  const tosPayload = {
    ...payload,
    v: 1
  }

  console.log(await req('POST', '/history', payload))
  console.log(await req('GET', '/tos'))

  console.log(await req('POST', '/s-tos', tosPayload))
  console.log(await req('POST', '/g-tos', tosPayload))
  console.log(await req('POST', '/login', tosPayload))
})()

;(async () => {
  const sb = await getSunbeam(config)
  const meta = await sb.getSignedTx()

  const payload = { meta }

  console.log(await req('GET', '/competitions'))
  console.log(await req('GET', '/competitions/1'))
  console.log(await req('GET', '/competitions/active'))
  console.log(await req('GET', '/competitions/1/leaderboard/vol'))
  console.log(await req('GET', '/competitions/1/leaderboard/pnl'))
  console.log(await req('POST', '/competitions/1/signup', payload))
  console.log(await req('GET', '/competitions/1/signup', payload))
})()

;(async () => {
  // mainchain verify and fwd tx
  const expireInSeconds = 30
  const user = 'testuser1111'
  const client = getClient(config)

  const txdata = {
    actions: [{
      account: 'testfaucet11',
      name: 'verify',
      authorization: [{
        actor: user,
        permission: 'active'
      }],
      data: {
        account: user
      }
    }]
  }

  const tx = await client.api.transact(txdata, {
    broadcast: false,
    blocksBehind: 3,
    expireSeconds: expireInSeconds
  })

  tx.serializedTransaction = eos.Serialize.arrayToHex(tx.serializedTransaction)

  const payload = {
    t: tx,
    v: 1,
    code: 'TEST12'
  }

  console.log(await req('POST', '/sm-tos', payload))
  console.log(await req('POST', '/gm-tos', payload))
  console.log(await req('POST', '/push-tx', payload))
})()
