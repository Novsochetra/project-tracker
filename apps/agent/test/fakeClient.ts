import { ApiError } from '@tracker/client';
import type { TrackerApi } from '../src/client';

export const fakeClient = (methods: Partial<TrackerApi>): TrackerApi => methods as TrackerApi;

export const returns =
  <T>(value: T) =>
  (): Promise<T> =>
    Promise.resolve(value);

export const rejectWith = (status: number, code: string, message: string) => () =>
  Promise.reject(new ApiError(status, code, message));

export const imageResponse = (bytes: number): Response =>
  new Response(new Uint8Array(bytes).fill(7), { headers: { 'content-type': 'image/png' } });
