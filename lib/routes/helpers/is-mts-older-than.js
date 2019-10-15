'use strict'

const { differenceInMinutes } = require('date-fns')

module.exports = (mts = 0, minutes = 2) => {
  const unixNow = Date.now() / 1000

  const diff = differenceInMinutes(
    unixNow,
    mts
  )

  return diff > minutes
}
