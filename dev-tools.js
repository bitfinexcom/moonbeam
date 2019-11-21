'use strict'

const Sunbeam = require('sunbeam')

const { Api, JsonRpc } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')

const fetch = require('node-fetch')
const { TextDecoder, TextEncoder } = require('util')

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

  const client = {
    rpc,
    api
  }

  return client
}
