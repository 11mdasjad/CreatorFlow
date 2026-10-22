export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const csrf =
    typeof document === 'undefined'
      ? ''
      : document.cookie
          .split('; ')
          .find((v) => v.startsWith('cf_csrf='))
          ?.split('=')[1] || '';
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf, ...options.headers },
    });
  } catch {
    throw new ApiError('Cannot reach CreatorFlow. Check that the API is running.', 503);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      typeof data.error?.message === 'string'
        ? data.error.message
        : Array.isArray(data.error?.message)
          ? data.error.message.join(', ')
          : 'The request could not be completed',
      response.status,
    );
  return data;
}
export const send = (path: string, data: unknown, method = 'POST') =>
  api(path, { method, body: JSON.stringify(data) });
export function money(minor: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
export function date(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}
