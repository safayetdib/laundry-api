/**
 * OpenAPI skeleton. Grows as modules are added; each module contributes its
 * paths and schemas. The envelope schemas below are the shared response
 * contract from docs/03-API-CONTRACT.md.
 */
export const openapiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Folded API (laundry-api)',
    version: '0.1.0',
    description: 'Central API for the Folded managed laundry service.',
  },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/openapi.json': {
      get: {
        summary: 'This OpenAPI document',
        responses: { '200': { description: 'OpenAPI document' } },
      },
    },
  },
  components: {
    schemas: {
      SuccessEnvelope: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: {},
          meta: {
            type: 'object',
            required: ['requestId'],
            properties: { requestId: { type: 'string' } },
          },
        },
      },
      ErrorEnvelope: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;
