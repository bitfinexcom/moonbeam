'use strict'

const { dbUsers } = require('config')

const db = require('moonbeam-mongodb')(dbUsers)

const collections = {}
exports.db = db
exports.getCollection = collection => collections[collection]

exports.start = () =>
  new Promise((resolve, reject) => {
    db.start(err => {
      if (err) return reject(err)
      collections.trades = db.db.collection(dbUsers.collectionTrades)
      resolve()
    })
  })

exports.stop = () =>
  new Promise((resolve, reject) => {
    db.stop(err => {
      if (err) return reject(err)
      resolve()
    })
  })
