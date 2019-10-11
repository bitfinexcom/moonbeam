'use strict'

const { differenceInMinutes } = require('date-fns')

module.exports = (mts = Date.now(), minutes = 2) => {
  const diff = differenceInMinutes(
    Date.now(),
    mts
  )

  return diff > minutes
}
