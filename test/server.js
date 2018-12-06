'use strict'

const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 3928 })

wss.on('connection', function (ws) {
  ws.on('message', function (message) {
    console.log('received: %s', message)
    ws.send(`[0, ${message}, true]`)
  })
})
