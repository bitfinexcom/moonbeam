'use strict'

const MongoClient = require('mongodb').MongoClient

function getMongoCollection (opts, cb) {
  const client = new MongoClient(opts.mongoUrl)

  client.connect((err) => {
    if (err) return cb(err)

    const db = client.db(opts.dbName)
    const collection = db.collection('userdata')
    cb(null, client, collection)
  })
}

module.exports = getMongoCollection
