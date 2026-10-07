import type { PromptDefinition } from './prompt';
import { reviewPrompt } from './review';
import { workPrompt } from './work';

export const PROMPTS: readonly PromptDefinition[] = [workPrompt, reviewPrompt];
