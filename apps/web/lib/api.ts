export class ApiError extends Error {
  constructor(public status: number, public code: string, public detail?: string) {
    super(code);
  }
}

export async function api<T = unknown>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, data?.title ?? "error", data?.detail);
  return data as T;
}
export const get = <T,>(p: string) => api<T>("GET", p);
export const post = <T,>(p: string, b: unknown = {}) => api<T>("POST", p, b);
export const put = <T,>(p: string, b: unknown = {}) => api<T>("PUT", p, b);
