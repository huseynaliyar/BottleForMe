import { NextResponse } from 'next/server';
import { INITIAL_OFFERS } from '@/lib/mock-data';

/**
 * @swagger
 * /api/pickups/{id}:
 *   get:
 *     summary: Get details of a specific bottle pickup offer
 *     tags:
 *       - Pickups & Radar
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Offer details
 *       404:
 *         description: Offer not found
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const offer = INITIAL_OFFERS.find((o) => o.id === params.id);
  if (!offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }
  return NextResponse.json(offer);
}

/**
 * @swagger
 * /api/pickups/{id}:
 *   patch:
 *     summary: Update offer status (reserve, claim, complete)
 *     tags:
 *       - Handover & Payments
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [reserved, en_route, arrived, completed, cancelled]
 *               collector_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const offer = INITIAL_OFFERS.find((o) => o.id === params.id);
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    if (body.status) offer.status = body.status;
    if (body.collector_name) offer.collector_name = body.collector_name;
    offer.updated_at = new Date().toISOString();

    return NextResponse.json(offer);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 400 });
  }
}
