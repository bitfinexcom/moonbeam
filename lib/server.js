'use strict'

const fs = require('fs')
const express = require('express')
const _cors = require('cors')
const helmet = require('helmet')
const ecc = require('eosjs-ecc')
const { port, socket, cors } = require('config')

const router = require('./routes')
const db = require('./helpers/db')
const grenache = require('./helpers/grenache')
const { errorHandler } = require('./helpers/middlewares')

async function start () {
  if (port && socket) throw new Error('ERR_SOCK_PORT')
  if (!port && !socket) throw new Error('ERR_NO_SOCK_PORT')

  grenache.start()
  await db.start()
  await ecc.initialize()

  const app = express()

  app.use(helmet())
  app.use(express.json())
  app.use(_cors(cors))
  app.use(router)

  app.use((req, res) => res.status(404).json({ error: 'ERR_NO_ROUTE' }))

  app.use(errorHandler)

  return new Promise((resolve, reject) => {
    const errorHandler = err => {
      app.removeListener('error', errorHandler)
      reject(err)
    }

    if (port) {
      const server = app.listen(port)

      app.on('listening', () => {
        console.log('server started on', port)
        resolve(server)
      })

      app.on('error', errorHandler)

      return server
    }

    if (socket) {
      try {
        fs.unlinkSync(socket)
      } catch (err) {
        if (err && err.code !== 'ENOENT') {
          return reject(err)
        }
      }
      const server = app.listen(socket)

      app.on('listening', () => {
        fs.chmod(socket, 0o777, err => {
          if (err) {
            return reject(err)
          }

          console.log('server started on', socket)
          resolve(server)
        })
      })

      app.on('error', errorHandler)

      return server
    }
  })
}

exports.start = start
