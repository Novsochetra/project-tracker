// Added by savedAnswerPlugin to reads the service worker answered from its cache.
export const SAVED_ANSWER_HEADER = 'x-tracker-saved';

let lastWasSaved = false;
const listeners = new Set<() => void>();

export const isSavedAnswer = (response: Response): boolean =>
  response.headers.has(SAVED_ANSWER_HEADER);

export const lastAnswerWasSaved = (): boolean => lastWasSaved;

export function noteAnswer(response: Response): void {
  const saved = isSavedAnswer(response);
  if (saved === lastWasSaved) return;
  lastWasSaved = saved;
  listeners.forEach((listener) => listener());
}

export function subscribeSavedAnswers(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The API client gives the app only the body, so the header is read here, where every request
// passes. Each answer is noted before its query reports success.
export function watchSavedAnswers(scope: { fetch: typeof fetch }): () => void {
  const fetchAnswer = scope.fetch;
  scope.fetch = async (input, init) => {
    const response = await fetchAnswer.call(scope, input, init);
    noteAnswer(response);
    return response;
  };
  return () => {
    scope.fetch = fetchAnswer;
  };
}
