'use strict'

const axios = require('axios')

exports.getReq = getReq
function getReq (baseUrl) {
  return async function req (method, upath, payload) {
    const opts = {
      method: method,
      url: `${baseUrl}${upath}`
    }

    if (payload) {
      opts.data = payload
    }
    try {
      const { data } = await axios(opts)
      return data
    } catch (e) {
      const str = e.response && e.response.data && e.response.data.error
      if (!str) {
        console.error(e)
        return
      }
      console.error('Error:', str, '\ndetails:', e.response.data.details)
      return e.response.data
    }
  }
}
