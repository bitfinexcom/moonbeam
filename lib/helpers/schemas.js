'use strict'

const Joi = require('@hapi/joi')
const { maxResults } = require('config')

const transactionData = Joi.object({
  s: Joi.string().min(1).max(2048).required(),
  t: Joi.string().min(1).max(2048).required()
}).required()

const captcha = Joi.string().min(1).max(9068).required()

const id = Joi.number().integer().min(1).max(999999999).required()

exports.competitionId = Joi.object({ id })

exports.competitionIdType = Joi.object({ id, type: Joi.string().valid('pnl', 'vol').required() })

exports.history = Joi.object({
  auth: transactionData,
  data: Joi.object({
    limit: Joi.number().integer().min(1).max(maxResults).default(maxResults)
  }).default()
})

exports.getSettings = Joi.object({
  auth: transactionData,
  data: Joi.array().min(1).max(64).items(Joi.string().min(1).max(128)).required()
})

exports.setSetting = Joi.object({
  auth: transactionData,
  data: Joi.object({
    value: Joi.string().min(0).max(64).required()
  }).required()
})

exports.auth = Joi.object({ auth: transactionData })

exports.pushTransaction = Joi.object({ data: transactionData })

exports.register = Joi.object({
  captcha,
  data: Joi.object({
    settings: Joi.object({
      email: Joi.string().email()
    }).default({}),
    tx: transactionData
  }).required()
})
