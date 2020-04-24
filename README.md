[![Build Status](https://travis-ci.org/bitfinexcom/moonbeam.svg?branch=master)](https://travis-ci.org/bitfinexcom/moonbeam)

# moonbeam

Moonbeam manages eosfinex users historical data and account management activities.

Setup
* Create a `config/<ENV>.js` file for the environment you're planning to use. `config/<ENV>.js` extends `config/default.js`. More info [here](https://github.com/lorenwest/node-config/wiki/Configuration-Files)
* Fill in properties to override or extend `config/default.js` ones
* Use `NODE_ENV=<ENV>` when you start application to use `config/<ENV.js>`
* In order to override config on application start, check [here](https://github.com/lorenwest/node-config/wiki/Command-Line-Overrides)

```
NODE_ENV=[test/development/production] node worker.js
```

## indexes

1. messages indexes
2. affiliate indexes
3. user indexes
4. usersettings indexes
