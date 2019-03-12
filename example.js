'use strict'

const { port } = require('./config/moonbeam.conf.json')
const { getReq } = require('./test/helper')

const req = getReq(port)

;(async () => {
  const payload = {
    "meta": {
      "expiration": "2019-03-08T14:23:23",
      "ref_block_num": 31766,
      "ref_block_prefix": 506243300,
      "max_net_usage_words": 0,
      "max_cpu_usage_ms": 0,
      "delay_sec": 0,
      "context_free_actions": [],
      "actions": [
        {
          "account": "efinexchange",
          "name": "validate",
          "authorization": [
            {
              "actor": "testuser1114",
              "permission": "active"
            }
          ],
          "data": ""
        }
      ],
      "transaction_extensions": [],
      "signatures": [
        "SIG_K1_JzxfeT56y6pE8adfcC6NHEof535SRaKCxK7wdUktsEDgDZEcyLFYVi7wRrqYdLyqCmj7MwvhxZZnPScVgqmJMStWaUn9CD"
      ]
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
