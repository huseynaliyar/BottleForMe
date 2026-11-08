const json = (schema: object) => ({ 'application/json': { schema } });
const pickup = { $ref: '#/components/schemas/PickupOffer' };
const containers = { $ref: '#/components/schemas/ContainerBreakdown' };
const auth = [{ BearerAuth: [] }];
const id = { in: 'path', name: 'id', required: true, schema: { type: 'string' }, description: 'Pickup UUID or development fixture ID.' };
const status = { type: 'string', enum: ['open', 'reserved', 'en_route', 'arrived', 'completed', 'cancelled'] };
const integer = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum });

export function getApiDocs() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'BottleForMe Pickup API',
      version: '1.0.0',
      description: 'Discover and arrange pickups of eligible Malta BCRS containers. Seller payments are arranged directly between participants.',
    },
    servers: [{ url: '/' }],
    paths: {
      '/api/pickups': {
        get: {
          summary: 'List open Radar pickups or your own pickups',
          description: 'Radar responses contain locality-level data. Set mine=true with a bearer token to view pickups you listed or reserved.',
          security: [{}, ...auth],
          parameters: [
            { in: 'query', name: 'locality', schema: { type: 'string' } },
            { in: 'query', name: 'mine', schema: { type: 'boolean' } },
          ],
          responses: {
            200: { description: 'Pickup list', content: json({ type: 'object', properties: {
              count: { type: 'integer' }, offers: { type: 'array', items: pickup }, source: { type: 'string' },
            } }) },
            401: { description: 'Sign in to view your pickups' },
            503: { description: 'Pickup service unavailable' },
          },
        },
        post: {
          summary: 'Publish a pickup as the signed-in seller',
          security: auth,
          parameters: [{
            in: 'header', name: 'Idempotency-Key', schema: { type: 'string', format: 'uuid' },
            description: 'Reuse this key to retry the same publication without creating a second listing.',
          }],
          requestBody: { required: true, content: json({ $ref: '#/components/schemas/CreateOfferRequest' }) },
          responses: {
            201: { description: 'Published pickup', content: json(pickup) },
            200: { description: 'Pickup already published for this request key', content: json(pickup) },
            400: { description: 'Invalid listing input' },
            401: { description: 'Sign in to publish' },
            409: { description: 'Request key in use' },
            503: { description: 'Pickup service unavailable' },
          },
        },
      },
      '/api/pickups/{id}': {
        get: {
          summary: 'Get a pickup visible to the caller',
          parameters: [id],
          security: [{}, ...auth],
          responses: {
            200: { description: 'Public or participant pickup details', content: json(pickup) },
            404: { description: 'Pickup not visible or not found' },
          },
        },
        patch: {
          summary: 'Reserve, update or cancel a pickup',
          description: 'Reservations are exclusive. An assigned collector can record progress or completion. Either participant can cancel an active pickup.',
          security: auth,
          parameters: [id],
          requestBody: { required: true, content: json({
            type: 'object', required: ['status'], properties: { status: { ...status, enum: status.enum.slice(1) } },
          }) },
          responses: {
            200: { description: 'Updated pickup', content: json(pickup) },
            400: { description: 'Invalid status' },
            401: { description: 'Sign in to change a pickup' },
            409: { description: 'Pickup unavailable or transition not allowed' },
          },
        },
      },
    },
    components: {
      securitySchemes: { BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        ContainerBreakdown: {
          type: 'object',
          required: ['plastic_bottles', 'cans', 'glass_bottles'],
          properties: { plastic_bottles: integer(0, 10_000), cans: integer(0, 10_000), glass_bottles: integer(0, 10_000) },
        },
        PickupOffer: {
          type: 'object',
          properties: {
            id: { type: 'string' }, locality: { type: 'string' }, containers,
            bag_count: { type: 'integer' }, estimated_bottles: { type: 'integer' },
            total_bcrs_value: { type: 'number' }, split_percentage: { type: 'integer' },
            seller_payout: { type: 'number' }, collector_profit: { type: 'number' },
            payout_method: { type: 'string' }, status,
            seller_name: { type: 'string' },
            seller_phone: { type: 'string', nullable: true },
            seller_revolut_tag: { type: 'string', nullable: true },
            address_notes: { type: 'string', description: 'Private pickup instructions, when visible to the caller.' },
          },
        },
        CreateOfferRequest: {
          type: 'object',
          required: ['locality', 'containers', 'address_notes', 'bag_count', 'split_percentage', 'payout_method'],
          properties: {
            locality: { type: 'string' }, containers,
            address_notes: { type: 'string', maxLength: 300 },
            bag_count: integer(1, 20), split_percentage: integer(0, 70),
            payout_method: { type: 'string', enum: ['cash', 'revolut'] },
            seller_revolut_tag: { type: 'string', description: 'Required for a positive Revolut payment.' },
          },
        },
      },
    },
  };
}
