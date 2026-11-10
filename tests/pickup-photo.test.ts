import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { normalizePickupPhoto } from '../lib/pickup-photo-server';

test('listing photos are bounded JPEGs with their metadata removed', async () => {
  const source = await sharp({ create: { width: 1400, height: 700, channels: 3, background: 'green' } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const photo = await normalizePickupPhoto(source.toString('base64'));
  assert.ok(photo);
  const metadata = await sharp(Buffer.from(photo, 'base64')).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 1024);
  assert.equal(metadata.exif, undefined);
});

test('rejects missing, malformed and non-photo inputs', async () => {
  for (const input of [null, '', '%%%=', 'a'.repeat(1_400_004), Buffer.from('<svg />').toString('base64')]) {
    assert.equal(await normalizePickupPhoto(input), null);
  }
});
