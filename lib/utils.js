'use strict'

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
