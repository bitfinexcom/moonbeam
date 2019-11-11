'use strict'

const { port } = require('./config/moonbeam.conf.json')
const { getReq } = require('./test/helper')

const configSunbeam = require('./config/dev-signing-ws.config.json')
const getSunbeam = require('./dev-get-signed-tx')

const req = getReq(port)

;(async () => {
  const sb = await getSunbeam(configSunbeam)
  const payload = await sb.getSignedTx()

  /*
  const payload = {
    meta: {
      expiration: '2019-04-25T15:29:41.000',
      ref_block_num: 37020,
      ref_block_prefix: 186465237,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: [{ account: 'efinexchange', name: 'validate', authorization: [{ actor: 'testuser1113', permission: 'active' }], data: '' }],
      transaction_extensions: [],
      signatures: ['SIG_K1_Khej9TF52MbqXNdAeD4fDTMvADj7d7YpquGzPhd6DqP3Wgd5q38aKhWmCd8gZwUwgjFwM3pJVUaMVGi2fdo7UoW3cFw5mX']
    },
    limit: 50
  }
  */

  console.log(await req('POST', '/history', payload))
  console.log(await req('GET', '/tos'))

  payload.v = 1
  console.log(await req('POST', '/s-tos', payload))
  console.log(await req('POST', '/g-tos', payload))
})()

;(async () => {
  console.log(await req('GET', '/v2/candles/trade:1m:tEOS.USD/last'))

  const end = Date.now()
  console.log(await req('GET', `/v2/candles/trade:1m:tEOS.USD/hist?end=${end}`))

  const res = ''
  console.log(await req('POST', '/fauxh', { user: 'testuser4321', response: res }))
})()
