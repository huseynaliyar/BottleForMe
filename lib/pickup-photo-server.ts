import sharp from 'sharp';

export async function normalizePickupPhoto(input: unknown): Promise<string | null> {
  if (typeof input !== 'string' || input.length > 1_400_000 || input.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(input)) return null;
  try {
    const image = sharp(Buffer.from(input, 'base64'), { limitInputPixels: 16_000_000 });
    const { format } = await image.metadata();
    if (format !== 'jpeg' && format !== 'png' && format !== 'webp') return null;
    const jpeg = await image.autoOrient().resize({
      width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true,
    }).jpeg({ quality: 72 }).toBuffer();
    return jpeg.length <= 512 * 1024 ? jpeg.toString('base64') : null;
  } catch {
    return null;
  }
}
