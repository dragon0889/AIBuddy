import { z } from "zod";

export class AppError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}
export const badRequest = (code: string, msg?: string) => new AppError(400, code, msg);
export const unauthorized = (code = "unauthorized") => new AppError(401, code);
export const forbidden = (code = "forbidden") => new AppError(403, code);
export const notFound = (code = "not_found") => new AppError(404, code);
export const conflict = (code: string) => new AppError(409, code);
export const tooMany = (code = "rate_limited") => new AppError(429, code);

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError(400, "validation_error", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return r.data;
}
