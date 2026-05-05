type TokenProvider = (options?: { skipCache?: boolean }) => Promise<string | null>;

const DEFAULT_API_BASE = "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  getToken?: TokenProvider,
): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  async function attachToken(forceRefresh = false) {
    if (!getToken) return;
    const token = await getToken(forceRefresh ? { skipCache: true } : undefined);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  await attachToken(false);

  let response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && getToken) {
    await attachToken(true);
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      if (data?.error) {
        message = data.error;
      }
    } catch {
      // Ignore parse errors.
    }

    throw new ApiError(response.status, message || "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export type { TokenProvider };
