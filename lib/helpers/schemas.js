'use strict'

const Joi = require('@hapi/joi')
const { maxResults } = require('config')

const transactionData = Joi.object({
  s: Joi.string().min(1).max(256).required(),
  t: Joi.string().min(1).max(256).required()
}).required()

const captcha = Joi.string().min(1).max(9068).required()

exports.history = Joi.object({
  auth: transactionData,
  data: Joi.object({
    limit: Joi.number().integer().min(1).max(maxResults).default(maxResults)
  }).default()
})

exports.setSetting = Joi.object({
  auth: transactionData,
  data: Joi.object({
    value: Joi.string().min(1).max(64).required()
  }).required()
})

exports.auth = Joi.object({
  auth: transactionData
})

exports.pushTransaction = Joi.object({
  data: transactionData
})

exports.register = Joi.object({
  captcha,
  data: Joi.object({
    settings: Joi.object({
      affCode: Joi.string().min(1).max(64),
      email: Joi.string().email()
    }).default({}),
    tx: transactionData
  }).required()
})
