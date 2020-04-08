'use strict'

const Joi = require('joi')

const transactionData = Joi.object({
  s: Joi.string().required(),
  t: Joi.string().required()
}).required()

const captcha = Joi.string().required()

// TODO: add more restrictions
exports.register = {
  captcha,
  data: Joi.object({
    settings: Joi.object({
      affCode: Joi.string(),
      email: Joi.string()
    }),
    tx: transactionData
  }).required()
}
