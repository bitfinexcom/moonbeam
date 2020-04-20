'use strict'

const { Api, JsonRpc, Serialize } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const ecc = require('eosjs-ecc')
const fetch = require('node-fetch')
const { TextDecoder, TextEncoder } = require('util')

const { cosign, nodeHttpUrl, contract, tosCurrent } = require('config')

const api = new Api({
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder()
})

const rpc = new JsonRpc(nodeHttpUrl, { fetch })
const coSignatureProvider = new JsSignatureProvider([cosign.pKey])

exports.recoverPubKey = async ({ s, t }) => {
  const { chain_id: chainId } = await rpc.get_info()
  const signBuf = Buffer.concat([
    Buffer.from(chainId, 'hex'), Buffer.from(t, 'hex'), Buffer.from(new Uint8Array(32))
  ])

  return ecc.recover(s, signBuf)
}

exports.checkUserSignedTos = account =>
  rpc.get_table_rows({
    json: true,
    code: contract,
    scope: account,
    table: 'users'
  }).then(({ rows, more }) => {
    if (more || rows.length > 1) {
      throw new Error('More than 1 row was found for ' + account)
    }
    if (!rows.length) {
      return false
    }
    const tos = Number(rows[0].status) >> 0
    return tos === tosCurrent
  })

exports.getAccount = account => rpc.get_account(account)

exports.hexToObj = hexTx => {
  const txArr = Serialize.hexToUint8Array(hexTx)
  return {
    txArr,
    txObj: api.deserializeTransaction(txArr)
  }
}

exports.coSign = async ({ serializedTransaction, signatures }) => {
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

exports.pushTx = async txData => {
  try {
    const txRes = await rpc.push_transaction(txData)
    if (!txRes.transaction_id || !txRes.processed) {
      return { error: 'ERR_INVALID_KEY' }
    }
    return { txId: txRes.transaction_id }
  } catch (e) {
    if (e.json && e.json.error && e.json.error.code === 3080004) {
      return { error: 'ERR_CPU', details: [e.message] }
    }

    return { error: 'ERR_TX_INVALID', details: [e.message] }
  }
}

exports.parseAndVerifyTx = (txHex, supportedActions) => {
  const result = {}
  let txData
  try {
    txData = exports.hexToObj(txHex)
    result.txData = txData
  } catch (e) {
    return { error: 'ERR_TX_INVALID', details: ['Wrong serialized transaction data'] }
  }

  const perms = ['active', 'owner']
  const { txObj } = txData
  const { actions, context_free_actions: cfa, transaction_extensions: tes } = txObj

  if (cfa.length !== 0 || tes.length !== 0) {
    return { error: 'ERR_TX_INVALID', details: ['Wrong transaction data'] }
  }

  if (actions.length !== 1) {
    return { error: 'ERR_TX_INVALID', details: ['Wrong amount of actions'] }
  }
  const action = actions[0]
  if (!supportedActions.includes(action.name)) {
    return { error: 'ERR_TX_INVALID', details: ['Wrong action name'] }
  }

  if (action.name !== 'transfer') {
    if (action.account !== contract) {
      return { error: 'ERR_TX_INVALID', details: ['Wrong action account'] }
    }
  }

  const correctPermissions = perms.includes(action.authorization[action.authorization.length - 1].permission)
  if (!correctPermissions) {
    return { error: 'ERR_TX_INVALID', details: ['Wrong permissions'] }
  }

  return result
}
