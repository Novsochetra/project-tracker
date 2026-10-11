import sharp from 'sharp';

// The profiles libvips carries: sRGB, Display P3 (what an iPhone photo has) and a CMYK one of
// almost 1 MB, which a JPEG holds in many segments. Made here, so no profile file is checked in.
export type BuiltInProfile = 'srgb' | 'p3' | 'cmyk';

const grey = (profile: BuiltInProfile) => {
  const image = sharp({ create: { width: 16, height: 12, channels: 3, background: '#808080' } });
  return (profile === 'cmyk' ? image.toColourspace('cmyk') : image).withIccProfile(profile);
};

export const jpegWithProfile = (profile: BuiltInProfile) => grey(profile).jpeg().toBuffer();

export const webpWithProfile = (profile: BuiltInProfile) => grey(profile).webp().toBuffer();

export async function iccProfile(profile: BuiltInProfile): Promise<Buffer> {
  return (await sharp(await jpegWithProfile(profile)).metadata()).icc!;
}

const ICC_PROFILE = Buffer.from('ICC_PROFILE\0', 'latin1');

export const iccChunk = (data: Buffer, number: number, count: number) =>
  Buffer.concat([ICC_PROFILE, Buffer.from([number, count]), data]);

const padded = (bytes: Buffer) => Buffer.concat([bytes, Buffer.alloc(-bytes.length & 3)]);

const tableEnd = (profile: Buffer) => 132 + 12 * profile.readUInt32BE(128);

export function withBytesAfterTags(profile: Buffer, hidden: Buffer): Buffer {
  const grown = Buffer.concat([profile, padded(hidden)]);
  grown.writeUInt32BE(grown.length, 0);
  return grown;
}

// The tags move along, so each still points at its own data.
export function withBytesBeforeTags(profile: Buffer, hidden: Buffer): Buffer {
  const gap = padded(hidden);
  const end = tableEnd(profile);
  const grown = Buffer.concat([profile.subarray(0, end), gap, profile.subarray(end)]);
  grown.writeUInt32BE(grown.length, 0);
  for (let at = 136; at < end; at += 12) {
    grown.writeUInt32BE(grown.readUInt32BE(at) + gap.length, at);
  }
  return grown;
}

// The first tag said to run past the profile's end, so the size check alone can't pass it.
export function withTagPastEnd(profile: Buffer): Buffer {
  const broken = Buffer.from(profile);
  broken.writeUInt32BE(profile.length, 140);
  return broken;
}
