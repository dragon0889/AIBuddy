"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError, get } from "./api";

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<ApiError | undefined>();
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); setError(undefined); } catch (e) { setError(e as ApiError); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}

export type Me = { id: string; role: "parent" | "admin"; emailVerified: boolean; locale: string };
export const useMe = () => useAsync(() => get<Me>("/api/v1/auth/me"), []);
