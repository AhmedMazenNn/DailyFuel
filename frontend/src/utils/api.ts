const API_BASE = '/api/v1';
export function csrfToken(): string {
  return decodeURIComponent(document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? '');
}
function errorMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(errorMessage).join(' ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, val]) => `${key === 'detail' || key === 'non_field_errors' ? '' : `${key}: `}${errorMessage(val)}`).join(' ');
  return 'Request failed. Please try again.';
}
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`, {
    ...init, credentials: 'same-origin',
    headers: { ...(init.body instanceof FormData ? {} : {'Content-Type': 'application/json'}), 'X-CSRFToken': csrfToken(), ...init.headers },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(body ? errorMessage(body) : `Request failed (${response.status}). Please try again.`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export function json<T>(path: string, method: string, body?: unknown, key?: string) {
  return request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: key ? {'Idempotency-Key': key} : undefined });
}
