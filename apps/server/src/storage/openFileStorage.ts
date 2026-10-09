import { createDiskStorage, removePartialFiles } from './diskStorage';
import type { FileStorage } from './fileStorage';
import type { S3Config } from './s3Config';

export interface StorageSettings {
  s3: S3Config | null;
  uploadsDir: string;
}

export async function openFileStorage(settings: StorageSettings): Promise<FileStorage> {
  if (!settings.s3) {
    await removePartialFiles(settings.uploadsDir);
    return createDiskStorage(settings.uploadsDir);
  }
  // Loaded only when used: the AWS SDK is large, and local runs keep files on disk.
  const { createS3Client, createS3Storage } = await import('./s3Storage');
  return createS3Storage({ client: createS3Client(settings.s3), bucket: settings.s3.bucket });
}

export const describeStorage = ({ s3, uploadsDir }: StorageSettings): string =>
  s3 ? `S3 bucket ${s3.bucket} (${s3.endpoint ?? s3.region})` : uploadsDir;
