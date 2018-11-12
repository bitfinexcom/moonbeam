'use strict'

const MongoClient = require('mongodb').MongoClient

class MongoDbPlugin {
  constructor (opts) {
    this.conf = opts
  }

  _start (cb) {
    const client = this.client = new MongoClient(this.conf.mongoUrl)

    client.connect((err) => {
      if (err) return cb(err)

      cb(null, client)
    })
  }

  start (cb) {
    this._start((err, client) => {
      if (err) return cb(err)

      const { dbName, collection, indexes } = this.conf
      if (!dbName) return cb(null)
      this.db = client.db(dbName)
      if (!collection) return cb(null)
      this.collection = this.db.collection(collection)
      if (!indexes) return cb(null)
      indexes.forEach((idx) => {
        this.collection.createIndex(idx)
      })

      cb(null)
    })
  }

  stop (cb) {
    this.client.stop(cb)
  }
}

function mongo (opts) {
  return new MongoDbPlugin(opts)
}

module.exports = mongo
