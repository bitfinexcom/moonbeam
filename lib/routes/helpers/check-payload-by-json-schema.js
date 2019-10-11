'use strict'

const Ajv = require('ajv')

const { SchemaFindError } = require('../errors')
const jsonSchemas = require('./json-schemas')

const ajv = new Ajv()
const compiledJsonSchemas = Object.entries(jsonSchemas)
  .reduce((accum, [name, schema]) => {
    if (
      schema &&
      typeof schema === 'object'
    ) {
      accum[name] = ajv.compile({
        $async: true,
        ...schema
      })
    }

    return accum
  }, {})

module.exports = (
  payload,
  schemaName
) => {
  const validate = compiledJsonSchemas[schemaName]

  if (typeof validate !== 'function') {
    throw new SchemaFindError()
  }

  return validate(payload)
}
