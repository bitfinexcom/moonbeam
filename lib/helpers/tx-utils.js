'use strict'

const { Api, JsonRpc, Serialize } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const fetch = require('node-fetch')
const { TextDecoder, TextEncoder } = require('util')

const txTools = {
  api: new Api({
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  })
}

exports.init = ({ cosign, verifyTxMain }) => {
  txTools.rpc = new JsonRpc(verifyTxMain.httpEndpoint, { fetch })
  txTools.coSignatureProvider = new JsSignatureProvider([cosign.pKey])
}

exports.hexToObj = hexTx => {
  const txArr = Serialize.hexToUint8Array(hexTx)
  return {
    txArr,
    txObj: txTools.api.deserializeTransaction(txArr)
  }
}

exports.coSign = async ({ serializedTransaction, signatures }) => {
  const { coSignatureProvider, rpc } = txTools
  const [availableKeys, { chain_id: chainId }] = await Promise.all([
    coSignatureProvider.getAvailableKeys(),
    rpc.get_info()
  ])
  const signArgs = {
    chainId,
    requiredKeys: availableKeys,
    serializedTransaction,
    abis: []
  }
  const { signatures: [serverSignature] } = await coSignatureProvider.sign(signArgs)
  signatures.unshift(serverSignature)
  return { serializedTransaction, signatures }
}

exports.pushTx = (txData) => txTools.rpc.push_transaction(txData)
