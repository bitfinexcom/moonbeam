'use strict'

const Grenache = require('grenache-nodejs-http')
const Link = require('grenache-nodejs-link')
const conf = require('../../config/moonbeam.conf')

const Peer = Grenache.PeerRPCClient

const link = new Link(conf.link)
const peer = new Peer(link, {})

exports.tradingCompetitionRequest = tradingCompetitionRequest
function tradingCompetitionRequest ({ action, args = [{}] }, onResponse) {
  const query = { action, args }
  peer.request('rest:eosfinex:tradingcompetition', query, { timeout: 10000 }, (err, data) => {
    if (err) return onResponse({ success: false, message: err.message })
    return onResponse({ success: true, data })
  })
}

exports.start = (cb = () => {}) => {
  peer.init()
  link.start()
  cb()
}

exports.stop = (cb = () => {}) => {
  peer.stop()
  link.stop()
  cb()
}
