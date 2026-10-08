// Overridable so two runs (for example two agents' checks) can share a machine.
export const API_PORT = Number(process.env.E2E_API_PORT ?? 4199);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5199);
export const API_URL = `http://localhost:${API_PORT}`;
