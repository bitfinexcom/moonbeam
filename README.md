[![Build Status](https://travis-ci.org/bitfinexcom/moonbeam.svg?branch=master)](https://travis-ci.org/bitfinexcom/moonbeam)

# moonbeam

Moonbeam manages offers historical data to eosfinex users.

```
cp config/moonbeam.conf.json.example config/moonbeam.conf.json
cp config/moonbeam.mongo.conf.json.example config/moonbeam.mongo.conf.json
cp config/mongo.pubtrades.conf.json.example config/mongo.pubtrades.conf.json
```

```
node worker.js [--$YOUR_CONFIG_OVERRIDES]
```

## indexes

1. https://github.com/bitfinexcom/moonbeam-history#indexes
2. candle worker indexes
