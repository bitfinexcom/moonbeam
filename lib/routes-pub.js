'use strict'

const { sendGenericError } = require('./helpers/utils')
const { coSign, pushTx } = require('./helpers/tx-utils')

const {
  sendNotFoundError,
  processCompetitionsError
} = require('./helpers/utils')

class RoutesPub {
  constructor (conf, plugins) {
    this.conf = conf
    this.plugins = plugins
  }

  onTosHttpRequest (req, res) {
    const { tosCurrent, tosCurrentDate } = this.conf

    res.status(200).json([tosCurrent, tosCurrentDate])
  }

  async onRegisterHttpRequest (req, res) {
    try {
      // TODO: handle settings (email, affiliate code)
      const { data: { tx, txArr } } = req.body
      const pushTxData = await coSign({
        serializedTransaction: txArr,
        signatures: [tx.s]
      })

      try {
        const txRes = await pushTx(pushTxData)
        if (!txRes.transaction_id || !txRes.processed) {
          return res.status(500).json({ error: 'ERR_INVALID_KEY' })
        }
        return res.json({ txId: txRes.transaction_id })
      } catch (e) {
        console.error(e)

        if (e.json && e.json.error && e.json.error.code === 3080004) {
          return res.status(500).json({ error: 'ERR_CPU', details: [e.message] })
        }

        return res.status(500).json({ error: 'ERR_TX_INVALID', details: [e.message] })
      }
    } catch (e) {
      console.error(e)
      sendGenericError(res)
    }
  }

  onCompetitionsHttpRequest (req, res) {
    const { tradingCompetitionRequest } = this.plugins.grenacheService

    tradingCompetitionRequest({ action: 'listCompetitions' }, result => {
      if (!result.success) return processCompetitionsError(result.message, res)

      res.status(200).json(result.data)
    })
  }

  onCompetitionHttpRequest (req, res) {
    const id = parseInt(req.params.id, 10)
    const { tradingCompetitionRequest } = this.plugins.grenacheService

    tradingCompetitionRequest({ action: 'getCompetition', args: [{ competitionId: id }] }, result => {
      if (!result.success) return processCompetitionsError(result.message, res)
      if (!result.data || !result.data.competition) return sendNotFoundError(res)

      res.status(200).json(result.data)
    })
  }

  onActiveCompetitionHttpRequest (req, res) {
    const { tradingCompetitionRequest } = this.plugins.grenacheService

    tradingCompetitionRequest({ action: 'getActiveCompetition' }, result => {
      if (!result.success) return processCompetitionsError(result.message, res)
      if (!result.data || !result.data.competition) return sendNotFoundError(res)

      res.status(200).json(result.data)
    })
  }

  onCompetitionLeaderboardHttpRequest (req, res) {
    const id = parseInt(req.params.id, 10)
    const { type } = req.params
    const { tradingCompetitionRequest } = this.plugins.grenacheService

    tradingCompetitionRequest({ action: 'getCompetitionLeaderboard', args: [{ competitionId: id, type }] }, result => {
      if (!result.success) {
        return processCompetitionsError(result.message, res)
      }

      res.status(200).json(result.data)
    })
  }
}

module.exports = RoutesPub
