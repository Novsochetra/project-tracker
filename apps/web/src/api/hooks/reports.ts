import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReportPreview, ReportResult } from '@tracker/shared';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { useApi } from '../context';
import { refreshForChange } from '../live/refreshForChange';
import { queryKeys } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';

export const REPORT_PREVIEW_DELAY_MS = 250;

export interface ApplyReportVariables {
  text: string;
  ticketKey?: string;
}

export function useReportPreview(text: string, ticketKey?: string): TrackerQuery<ReportPreview> {
  const client = useApi();
  const debounced = useDebouncedValue(text, REPORT_PREVIEW_DELAY_MS);
  const settled = text.trim() ? debounced : '';
  const enabled = settled.trim().length > 0;
  return useQuery({
    queryKey: queryKeys.reportPreview(settled, ticketKey),
    queryFn: () => client.previewReport({ text: settled, ticketKey }),
    enabled,
    placeholderData: enabled ? keepPreviousData : undefined,
  });
}

export function useApplyReport(): TrackerMutation<ReportResult, ApplyReportVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplyReportVariables) => client.applyReport(input),
    onSuccess: (_result, variables) => refreshForChange(queryClient, null, variables),
  });
}
