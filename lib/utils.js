'use strict'

exports.log = log
function log (...args) {
  if (args[0] && args[0].json) {
    args[0].str = JSON.stringify(args[0].json)
  }

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
  const [frame, pair] = framePair.split(':')
  if (!isTimeFrameSupported(frame)) {
    return cb(new Error('ERR_INVALID_TIMEFRAME'))
  }

  cb(null, [frame, pair])
}

const competitionParamsVerifiers = {
  id: val => new RegExp(/^[1-9]\d*$/).test(val),
  type: val => ['vol', 'pnl'].includes(val)
}
exports.verifyCompetitionParams = verifyCompetitionParams
function verifyCompetitionParams (paramNames = []) {
  return (req, res, next) => {
    const suitable = paramNames.every(param => competitionParamsVerifiers[param](req.params[param]))
    if (suitable) return next()

    res.status(400).json({ error: 'ERR_BAD_REQUEST' })
  }
}

exports.sendGenericError = sendGenericError
function sendGenericError (res) {
  res.status(500).json({ error: 'ERR_GENERIC' })
}

exports.sendNotFoundError = sendNotFoundError
function sendNotFoundError (res) {
  res.status(404).json({ error: 'ERR_NOT_FOUND' })
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

exports.processCompetitionsError = processCompetitionsError
function processCompetitionsError (msg, res) {
  switch (msg) {
    case 'ERR_WRONG_TYPE':
      return res.status(400).json({ error: 'ERR_WRONG_TYPE' })
    case 'ERR_NOT_FOUND':
      return sendNotFoundError(res)
    case 'ERR_COMP_COMPLETE':
    case 'ERR_COMP_INACTIVE':
    case 'ERR_NOT_READY':
      return res.status(500).json({ error: msg })
    default:
      return sendGenericError(res)
  }
}
