'use strict'

const { dbUsers } = require('config')

const db = require('moonbeam-mongodb')(dbUsers)

exports.start = () =>
  new Promise((resolve, reject) => {
    db.start(err => {
      if (err) return reject(err)
      exports.tradesCollection = db.db.collection(dbUsers.collectionTrades)
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

exports.db = db
