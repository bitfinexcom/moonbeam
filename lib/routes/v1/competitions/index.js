'use strict'

const router = require('express').Router()
const { getSchemaValidationMw, checkAuth } = require('../../../helpers/middlewares')
const { sendNotFoundError, processCompetitionsError, verifyCompetitionParams } = require('../../../helpers/utils')
const { tradingCompetitionRequest } = require('../../../helpers/grenache')
const { auth } = require('../../../helpers/schemas')

router.get('/', (req, res) => {
  tradingCompetitionRequest({ action: 'listCompetitions' }, result => {
    if (!result.success) return processCompetitionsError(result.message, res)

    res.status(200).json(result.data)
  })
})

router.get('/active', (req, res) => {
  tradingCompetitionRequest({ action: 'getActiveCompetition' }, result => {
    if (!result.success) return processCompetitionsError(result.message, res)
    if (!result.data || !result.data.competition) return sendNotFoundError(res)

    res.status(200).json(result.data)
  })
})

router.get('/:id', verifyCompetitionParams(['id']), (req, res) => {
  const id = parseInt(req.params.id, 10)

  tradingCompetitionRequest({ action: 'getCompetition', args: [{ competitionId: id }] }, result => {
    if (!result.success) return processCompetitionsError(result.message, res)
    if (!result.data || !result.data.competition) return sendNotFoundError(res)

    res.status(200).json(result.data)
  })
})

router.get('/:id/leaderboard/:type', verifyCompetitionParams(['id', 'type']),
  (req, res) => {
    const id = parseInt(req.params.id, 10)
    const { type } = req.params

    tradingCompetitionRequest({ action: 'getCompetitionLeaderboard', args: [{ competitionId: id, type }] }, result => {
      if (!result.success) return processCompetitionsError(result.message, res)

      res.status(200).json(result.data)
    })
  })

router.post('/:id/signup/status', verifyCompetitionParams(['id']), getSchemaValidationMw(auth),
  checkAuth, (req, res) => {
    const { txObj } = req.body._validated.authTx
    const user = txObj.actions[0].authorization[0].actor
    const id = parseInt(req.params.id, 10)

    tradingCompetitionRequest({
      action: 'getSubscription',
      args: [{ competitionId: id, userName: user }]
    }, result => {
      if (!result.success) return processCompetitionsError(result.message, res)
      if (!result.data || !result.data.subscription) return sendNotFoundError(res)

      res.status(200).send(result.data)
    })
  })

router.post('/:id/signup', verifyCompetitionParams(['id']), getSchemaValidationMw(auth),
  checkAuth, (req, res) => {
    const { txObj } = req.body._validated.authTx
    const user = txObj.actions[0].authorization[0].actor
    const id = parseInt(req.params.id, 10)

    tradingCompetitionRequest({
      action: 'addSubscription',
      args: [{ competitionId: id, userName: user }]
    }, result => {
      if (!result.success) return processCompetitionsError(result.message, res)

      res.status(200).send(result.data)
    })
  })

module.exports = router
