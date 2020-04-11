'use strict'

const Joi = require('@hapi/joi')
const { maxResults } = require('config')

// TODO: improve restrictions

const transactionData = Joi.object({
  s: Joi.string().required(),
  t: Joi.string().required()
}).required()

const captcha = Joi.string().required()

exports.history = Joi.object({
  auth: transactionData,
  data: Joi.object({
    limit: Joi.number().integer().min(1).max(maxResults).default(maxResults)
  }).default()
})

exports.setSetting = Joi.object({
  auth: transactionData,
  data: Joi.object({
    value: Joi.string().required()
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
      affCode: Joi.string(),
      email: Joi.string()
    }).default({}),
    tx: transactionData
  }).required()
})
