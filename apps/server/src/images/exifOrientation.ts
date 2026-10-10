// The smallest EXIF (a TIFF header and IFD0) that still says which way is up: one Orientation entry.
// Kept when the rest of an image's metadata is dropped, so it isn't shown on its side.
export function orientationExif(orientation: number): Buffer {
  const exif = Buffer.alloc(26);
  exif.write('MM\0*', 0, 'latin1');
  exif.writeUInt32BE(8, 4);
  exif.writeUInt16BE(1, 8);
  exif.set([0x01, 0x12, 0x00, 0x03], 10);
  exif.writeUInt32BE(1, 14);
  exif.writeUInt16BE(orientation, 18);
  return exif;
}

export const isTurned = (orientation: number) => orientation >= 5 && orientation <= 8;

export const hasOrientation = (orientation: number) => orientation > 1 && orientation <= 8;
