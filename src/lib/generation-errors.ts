export function getGenerationErrorMessage(error: unknown, modelLabel: string): string {
  let current = error;
  let name = '';
  let status: unknown;
  // SDKs may wrap an API error in a no-output or retry error.
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    if ('name' in current && typeof current.name === 'string') name = current.name;
    if ('statusCode' in current) status = current.statusCode;
    else if ('status' in current) status = current.status;
    if (typeof status === 'number' || name === 'TimeoutError') break;
    current = 'cause' in current ? current.cause : 'lastError' in current ? current.lastError : undefined;
  }
  if (name === 'TimeoutError' || status === 504) {
    return `${modelLabel} did not respond before the time limit. Choose another model or try again later.`;
  }
  if (status === 429) return `${modelLabel}'s provider quota is exhausted. Try again later or choose another model.`;
  if (status === 401 || status === 403) return 'The provider rejected the API key or its permissions. Check the provider configuration.';
  if (status === 404) return `${modelLabel} is not available to this API key. Choose another model.`;
  if (status === 500 || status === 502 || status === 503) {
    return `${modelLabel}'s provider is temporarily unavailable. Choose another model or try again later.`;
  }
  return `${modelLabel} could not finish its response. Try again later or choose another model.`;
}
