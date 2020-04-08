'use strict'

const fetch = require('node-fetch')
const eos = require('eosjs')

const { TextDecoder, TextEncoder } = require('util')

const { port, cosign, verifyTxMain } = require('./config/moonbeam.conf.json')
const { getReq } = require('./test/helper')

const config = require('./config/dev-signing-ws.config.json')
const { getClient, getScatterSigner } = require('./dev-tools')

const req = getReq(`http://localhost:${port}`)

;(async () => {
  const { Api, JsonRpc, Serialize } = eos
  const rpc = new JsonRpc(cosign.httpEndpoint, { fetch })
  // used to create signature provider to simulate client
  // const uPrivKey = '<privKey>'
  const uPubKey = '<pubKey>'
  const uAccount = '<account>'
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

  // Use one of the signature providers to sign:
  // Scatter signature provider
  const signatureProvider = await getScatterSigner(rpc, uAccount)
  // User pKey signature provider
  // const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
  // const signatureProvider = new JsSignatureProvider([uPrivKey])

  const api = new Api({
    // use available keys to get partially signed transaction
    authorityProvider: {
      getRequiredKeys: () => signatureProvider.getAvailableKeys()
    },
    rpc: rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  })

  const { serializedTransaction, signatures } = await api.transact({ actions }, {
    ...opts,
    broadcast: false,
    sign: true
  })

  const hexTx = Serialize.arrayToHex(serializedTransaction)

  const payload = {
    captcha: 'captcha',
    data: { tx: { t: hexTx, s: signatures[0] } }
  }
  console.log(await req('POST', '/register', payload))
})()

/*
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

  // TODO: needs to be updated due to new sign tos process
  // console.log(await req('POST', '/login', tosPayload))
})()
*/

/* TODO: new auth needs to be applied
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
*/

;(async () => {
  // mainchain verify and fwd tx
  const expireInSeconds = 30
  const user = 'testuser4321'
  const client = getClient(config)

  const txdata = {
    actions: [{
      account: verifyTxMain.contract,
      name: 'validate',
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
  console.log(await req('POST', '/push-tx', payload))
})()
