'use strict'

const eos = require('eosjs')

const { port } = require('./config/moonbeam.conf.json')
const { getReq } = require('./test/helper')

const config = require('./config/dev-signing-ws.config.json')
const { getSunbeam, getClient } = require('./dev-tools')

const req = getReq(port)

;(async () => {
  // sidechain verify
  const sb = await getSunbeam(config)
  const meta = await sb.getSignedTx()

  const payload = {
    meta
  }

  console.log(await req('POST', '/history', payload))
  console.log(await req('GET', '/tos'))

  const tosPayload = {
    ...payload,
    v: 1
  }
  console.log(await req('POST', '/s-tos', tosPayload))
  console.log(await req('POST', '/g-tos', tosPayload))

  console.log(await req('GET', '/competition'))
  console.log(await req('GET', '/competition/leaderboard/vol'))
  console.log(await req('POST', '/competition/signup', payload))
})()

;(async () => {
  // mainchain verify
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
    expireSeconds: 10
  })

  tx.serializedTransaction = eos.Serialize.arrayToHex(tx.serializedTransaction)

  const payload = {
    t: tx,
    v: 1
  }

  console.log(await req('POST', '/sm-tos', payload))
  console.log(await req('POST', '/gm-tos', payload))
})()

;(async () => {
  // public endpoints
  console.log(await req('GET', '/v2/candles/trade:1m:tEOS.USD/last'))

  const end = Date.now()
  console.log(await req('GET', `/v2/candles/trade:1m:tEOS.USD/hist?end=${end}`))

  const res = ''
  console.log(await req('POST', '/fauxh', { user: 'testuser4321', response: res }))
})()
