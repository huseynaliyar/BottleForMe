import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = () => {
  const spec = createSwaggerSpec({
    apiFolder: 'app/api',
    definition: {
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
          url: 'http://localhost:3000',
          description: 'Local Development Server',
        },
      ],
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
              status: { type: 'string', enum: ['open', 'reserved', 'en_route', 'arrived', 'completed', 'cancelled'], example: 'open' },
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
    },
  });
  return spec;
};
