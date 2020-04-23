'use strict'

const router = require('express').Router()
const { getSchemaValidationMw, checkAuth, asyncMw } = require('../../../helpers/middlewares')
const { getCompetitionError } = require('../../../helpers/utils')
const { NotFoundError } = require('../../../helpers/errors')
const { tradingCompetitionRequest } = require('../../../helpers/grenache')
const { auth, competitionId, competitionIdType } = require('../../../helpers/schemas')

router.get('/', asyncMw(async (req, res, next) => {
  const result = await tradingCompetitionRequest({ action: 'listCompetitions' })
  if (!result.success) throw getCompetitionError(result.message)

  res.status(200).json(result.data)
}))

router.get('/active', asyncMw(async (req, res) => {
  const result = await tradingCompetitionRequest({ action: 'getActiveCompetition' })
  if (!result.success) throw getCompetitionError(result.message)
  if (!result.data || !result.data.competition) throw new NotFoundError('No active competition found', { error: 'ERR_NOT_FOUND' })

  res.status(200).json(result.data)
}))

router.get('/:id', getSchemaValidationMw(competitionId, 'params'), asyncMw(async (req, res) => {
  const { id } = req.params
  const result = await tradingCompetitionRequest({ action: 'getCompetition', args: [{ competitionId: id }] })

  if (!result.success) throw getCompetitionError(result.message)
  if (!result.data || !result.data.competition) throw new NotFoundError('No competition found', { error: 'ERR_NOT_FOUND' })

  res.status(200).json(result.data)
}))

router.get('/:id/leaderboard/:type', getSchemaValidationMw(competitionIdType, 'params'), asyncMw(async (req, res) => {
  const { id, type } = req.params
  const result = await tradingCompetitionRequest({
    action: 'getCompetitionLeaderboard',
    args: [{ competitionId: id, type }]
  })

  if (!result.success) throw getCompetitionError(result.message)

  res.status(200).json(result.data)
}))

router.post('/:id/rank/:type', getSchemaValidationMw(competitionIdType, 'params'), getSchemaValidationMw(auth), checkAuth,
  asyncMw(async (req, res) => {
    const { id, type } = req.params
    const { txObj } = req.body._validated.authTx
    const user = txObj.actions[0].authorization[0].actor

    const result = await tradingCompetitionRequest({
      action: 'getUserRank',
      args: [{ competitionId: id, type, userName: user }]
    })

    if (!result.success) throw getCompetitionError(result.message)

    res.status(200).json(result.data)
  }))

router.post('/:id/signup/status', getSchemaValidationMw(competitionId, 'params'), getSchemaValidationMw(auth), checkAuth,
  asyncMw(async (req, res) => {
    const { id } = req.params
    const { txObj } = req.body._validated.authTx
    const user = txObj.actions[0].authorization[0].actor
    const result = await tradingCompetitionRequest({
      action: 'getSubscription',
      args: [{ competitionId: id, userName: user }]
    })

    if (!result.success) throw getCompetitionError(result.message)
    if (!result.data || !result.data.subscription) throw new NotFoundError('No competition found', { error: 'ERR_NOT_FOUND' })

    res.status(200).send(result.data)
  }))

router.post('/:id/signup', getSchemaValidationMw(competitionId, 'params'), getSchemaValidationMw(auth), checkAuth,
  asyncMw(async (req, res) => {
    const { id } = req.params
    const { txObj } = req.body._validated.authTx
    const user = txObj.actions[0].authorization[0].actor
    const result = await tradingCompetitionRequest({
      action: 'addSubscription',
      args: [{ competitionId: id, userName: user }]
    })

    if (!result.success) throw getCompetitionError(result.message)

    res.status(200).send(result.data)
  }))

module.exports = router
