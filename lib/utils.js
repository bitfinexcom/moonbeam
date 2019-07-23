'use strict'

exports.log = log
function log (...args) {
  console.error.apply(null, args)
}

exports.isTimeFrameSupported = isTimeFrameSupported
function isTimeFrameSupported (f) {
  return [
    '1M', '6h', '12h', '1D', '7D', '14D', '1M',
    '1m', '5m', '15m', '30m', '1h', '3h'
  ].includes(f)
}

exports.checkCandlesReq = checkCandlesReq
function checkCandlesReq (type, cb) {
  if (!type || typeof type !== 'string') {
    return cb(new Error('ERR_INVALID_PATH'))
  }

  const framePair = type.replace(/^trade:/, '')
  const [ frame, pair ] = framePair.split(':')
  if (!isTimeFrameSupported(frame)) {
    return cb(new Error('ERR_INVALID_TIMEFRAME'))
  }

  cb(null, [ frame, pair ])
}

exports.sendGenericError = sendGenericError
function sendGenericError (res) {
  res.status(500).json({ error: 'ERR_GENERIC' })
}

exports.formatCandles = formatCandles
function formatCandles (candles) {
  const res = candles.map((entry) => {
    return [
      entry.t,
      dec(entry.open),
      dec(entry.close),
      dec(entry.high),
      dec(entry.low),
      entry.volume
    ]
  })

  return res
}

function dec (n) {
  return +n.toFixed(8)
}

exports.formatTrades = formatTrades
function formatTrades (trades) {
  const res = trades.map((entry) => {
    return [
      entry.id,
      entry.t,
      entry.amount,
      entry.price
    ]
  })

  return res
}
