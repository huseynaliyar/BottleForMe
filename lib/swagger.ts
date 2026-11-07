export const getApiDocs = () => {
  return {
    openapi: '3.0.0',
    info: {
      title: 'BottleForMe API - Malta BCRS P2P Marketplace',
      version: '1.0.0',
      description:
        'OpenAPI documentation for BottleForMe: connects Malta residents with empty BCRS deposit bottles/cans to local collectors with fair 50/50 split or free pickup and direct P2P Revolut/Cash payouts.',
      contact: {
        name: 'BottleForMe Malta',
        url: 'https://bottleforme.mt',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current Environment Server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Local Development Server',
      },
    ],
    paths: {
      '/api/pickups': {
        get: {
          summary: 'List active bottle pickup offers across Malta',
          description:
            'Retrieve all offers available on the Malta collector radar, with optional locality and status filtering. Powered by Supabase when configured.',
          tags: ['Pickups & Radar'],
          parameters: [
            {
              in: 'query',
              name: 'locality',
              schema: { type: 'string' },
              description: 'Filter by Malta town (e.g. Sliema, Birkirkara, Gzira)',
            },
            {
              in: 'query',
              name: 'status',
              schema: { type: 'string', default: 'open' },
              description: 'Offer status filter',
            },
          ],
          responses: {
            200: {
              description: 'Successfully returned list of pickup offers',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/PickupOffer',
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: 'Create a new bottle pickup offer in Malta',
          description:
            'Resident posts bags of BCRS empty bottles/cans with chosen deposit split (0% to 70%) and payout method (Revolut, Cash, or Charity).',
          tags: ['Pickups & Radar'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateOfferRequest',
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Offer successfully created and broadcast to collector radar',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/PickupOffer',
                  },
                },
              },
            },
            400: {
              description: 'Validation error: missing required fields or invalid split range',
            },
          },
        },
      },
      '/api/pickups/{id}': {
        get: {
          summary: 'Get details of a specific pickup offer',
          tags: ['Pickups & Radar'],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string' },
              description: 'Pickup offer UUID or mock identifier',
            },
          ],
          responses: {
            200: {
              description: 'Pickup offer details',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/PickupOffer',
                  },
                },
              },
            },
            404: {
              description: 'Offer not found',
            },
          },
        },
        patch: {
          summary: 'Update offer status (claim, arrive, complete handover)',
          description:
            'Collectors update status as they claim routes or complete doorstep handover. Zero platform custody: payout handled P2P via Revolut or cash.',
          tags: ['Pickups & Radar'],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['open', 'reserved', 'en_route', 'arrived', 'completed', 'cancelled'],
                    },
                    collector_id: { type: 'string' },
                    collector_name: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Offer status updated successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/PickupOffer',
                  },
                },
              },
            },
            400: {
              description: 'Invalid status update',
            },
            404: {
              description: 'Offer not found',
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        PickupOffer: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'malta-offer-101' },
            seller_name: { type: 'string', example: 'Maria Borg' },
            seller_phone: { type: 'string', example: '+356 9912 3456' },
            seller_revolut_tag: { type: 'string', example: '@maria_mlt' },
            locality: { type: 'string', example: 'Sliema' },
            address_notes: { type: 'string', example: 'Tower Road, near Preluna' },
            bag_count: { type: 'integer', example: 2 },
            estimated_bottles: { type: 'integer', example: 75 },
            total_bcrs_value: { type: 'number', example: 7.50 },
            split_percentage: { type: 'integer', example: 50 },
            seller_payout: { type: 'number', example: 3.75 },
            collector_profit: { type: 'number', example: 3.75 },
            payout_method: { type: 'string', enum: ['revolut', 'cash', 'charity'], example: 'revolut' },
            status: {
              type: 'string',
              enum: ['open', 'reserved', 'en_route', 'arrived', 'completed', 'cancelled'],
              example: 'open',
            },
            created_at: { type: 'string', example: '2026-11-08T00:00:00.000Z' },
          },
        },
        CreateOfferRequest: {
          type: 'object',
          required: ['seller_name', 'locality', 'bag_count'],
          properties: {
            seller_name: { type: 'string', example: 'Maria Borg' },
            seller_phone: { type: 'string', example: '+356 9912 3456' },
            seller_revolut_tag: { type: 'string', example: '@maria_mlt' },
            locality: { type: 'string', example: 'Sliema' },
            address_notes: { type: 'string', example: 'Tower Road, Intercom 4' },
            bag_count: { type: 'integer', example: 2 },
            split_percentage: { type: 'integer', default: 50, example: 50 },
            payout_method: { type: 'string', enum: ['revolut', 'cash', 'charity'], example: 'revolut' },
          },
        },
      },
    },
  };
};
