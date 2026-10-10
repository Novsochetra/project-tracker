const MODELS: Readonly<Record<string, string>> = { opus: 'opus', sonnet: 'sonnet', haiku: 'haiku' };

// Only a fixed name becomes an argument; default and anything unknown leave Claude's own model.
export function askModelArgs(model: unknown): string[] {
  const name =
    typeof model === 'string' && Object.hasOwn(MODELS, model) ? MODELS[model] : undefined;
  return name ? ['--model', name] : [];
}
