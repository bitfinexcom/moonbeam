'use strict'

const ScatterJS = require('scatterjs-core').default
const ScatterEOS = require('scatterjs-plugin-eosjs2').default
ScatterJS.plugins(new ScatterEOS())

const Sunbeam = require('sunbeam')

const { Api, JsonRpc } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')

const fetch = require('node-fetch')
const { TextDecoder, TextEncoder } = require('util')
const { URL } = require('url')

exports.getSunbeam = getSunbeam
function getSunbeam (config, env = 'staging') {
  return new Promise((resolve, reject) => {
    const opts = config[env]
    const client = getClient(config, env)

    const sb = new Sunbeam(client, opts)

    sb.once('open', () => {
      resolve(sb)
    })

    sb.once('error', reject)
    sb.open()
  })
}

exports.getClient = getClient
function getClient (config, env = 'staging') {
  const opts = config[env]

  const keys = opts.keys
  const httpEndpoint = opts.eos.httpEndpoint
  const signatureProvider = new JsSignatureProvider(keys)

  const rpc = new JsonRpc(httpEndpoint, { fetch })
  const api = new Api({
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  })

  return {
    rpc,
    api
  }
}

exports.getScatterSigner = getScatterSigner
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
