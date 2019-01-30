'use strict'

const { port } = require('./config/moonbeam.conf.json')
const { getReq } = require('./test/helper')

const req = getReq(port)

;(async () => {
  const payload = {
    meta: {
      'expiration': '2018-12-06T10:58:49',
      'ref_block_num': 33627,
      'ref_block_prefix': 180599882,
      'max_net_usage_words': 0,
      'max_cpu_usage_ms': 0,
      'delay_sec': 0,
      'context_free_actions': [],
      'actions': [{
        'account': 'efinexchange',
        'name': 'validate',
        'authorization': [{ 'actor': 'testuser4321', 'permission': 'active' }],
        'data': ''
      }],
      'transaction_extensions': [],
      'signatures': ['SIG_K1_JynbyfBZpdiQGJpfSyQ27Kx3FaMVh3fiLSC8ChLthqFc4QHZXhFiRGUEENukZ78AFhAXdvxwDRfTgpjnM9sPDYpquedq5C']
    },
    limit: 50
  }

  console.log(await req('POST', '/history', payload))
})()

;(async () => {
  console.log(await req('GET', '/v2/candles/trade:1m:tEOS.USD/last'))
  const end = Date.now()
  console.log(await req('GET', `/v2/candles/trade:1m:tEOS.USD/hist?end=${end}`))
})()
