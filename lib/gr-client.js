const Grenache = require('grenache-nodejs-http')
const Link = require('grenache-nodejs-link')
const conf = require('../config/moonbeam.conf')

const Peer = Grenache.PeerRPCClient

const link = new Link(conf.link)
link.start()

const peer = new Peer(link, {})
peer.init()

exports.notifySignup = ({ user }, cb) => {
  const query = {
    action: 'newSubscription',
    args: [{
      username: user
    }]
  }

  peer.request('rest:eosfinex:tradingcompetition', query, { timeout: 5000 }, (err, data) => {
    if (err) return cb(err)

    cb(null, data)
  })
}

exports.getCompetition = (cb) => {
  const query = {
    action: 'getCompetition'
  }

  peer.request('rest:eosfinex:tradingcompetition', query, { timeout: 5000 }, (err, data) => {
    if (err) return cb(err)

    cb(null, data)
  })
}

exports.getCompetitionResultsVol = (cb) => {
  const query = {
    action: 'getCompetitionLeaderboard',
    args: [{
      type: 'vol'
    }]
  }

  peer.request('rest:eosfinex:tradingcompetition', query, { timeout: 5000 }, (err, data) => {
    if (err) return cb(err)

    cb(null, data)
  })
}
