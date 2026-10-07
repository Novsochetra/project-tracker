import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

export type TrackerQuery<TData> = UseQueryResult<TData, Error>;

export type TrackerMutation<TData, TVariables> = UseMutationResult<
  TData,
  Error,
  TVariables,
  unknown
>;
