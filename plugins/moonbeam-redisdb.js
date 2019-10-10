'use strict'

const Redis = require('ioredis')

class RedisDbPlugin {
  constructor (opts) {
    const _baseName = 'moonbeam'
    const {
      unixSocket: path,
      port,
      host,
      password,
      sentinels,
      name
    } = { ...opts }

    this.conf = {
      path,
      port,
      host,
      password,
      sentinels,
      name: name
        ? `${_baseName}:${name}`
        : _baseName,
      keepAlive: 5000,
      lazyConnect: true
    }

    this.client = {}
  }

  start (cb) {
    this.client = new Redis(this.conf)

    this.client.connect()
      .then(() => cb(null, this.client))
      .catch(cb)
  }

  getKey (key) {
    return key
      ? `${this.conf.name}:${key}`
      : this.conf.name
  }

  hmset (key, val, expTime = 20) {
    const _key = this.getKey(key)
    const pipeline = this.client.pipeline()

    pipeline.hmset(_key, val)

    if (expTime) {
      pipeline.expire(_key, expTime)
    }

    return pipeline.exec()
  }

  hgetall (key) {
    const _key = this.getKey(key)

    return this.client.hgetall(_key)
  }

  stop (cb) {
    const timer = setTimeout(() => {
      if (this.client.status === 'end') {
        return
      }

      this.client.disconnect(cb)
    }, 10000)

    this.client.quit(() => {
      clearTimeout(timer)

      cb()
    })
  }
}

module.exports = (opts) => {
  return new RedisDbPlugin(opts)
}
