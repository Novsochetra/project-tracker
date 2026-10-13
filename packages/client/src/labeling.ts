import type { CreateLabelInput, Label, UpdateLabelInput } from '@tracker/shared';
import { AskingClient, segment } from './asking';

export class LabelingClient extends AskingClient {
  createLabel = (projectKey: string, input: CreateLabelInput) =>
    this.http.request<Label>('POST', `/api/projects/${segment(projectKey)}/labels`, {
      body: input,
    });

  updateLabel = (labelId: string, input: UpdateLabelInput) =>
    this.http.request<Label>('PATCH', `/api/labels/${segment(labelId)}`, { body: input });

  reorderLabels = (projectKey: string, ids: string[]) =>
    this.http.request<Label[]>('PUT', `/api/projects/${segment(projectKey)}/labels/order`, {
      body: { ids },
    });

  deleteLabel = (labelId: string) =>
    this.http.request<void>('DELETE', `/api/labels/${segment(labelId)}`);
}
