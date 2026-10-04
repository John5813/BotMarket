import { useQuery } from "@tanstack/react-query";
import type { Me, SiteConfig } from "./api";

export function useMe() {
  const q = useQuery<Me>({ queryKey: ["/api/auth/me"], staleTime: 10_000 });
  return { ...q, user: q.data?.user ?? null, balance: q.data?.balance ?? 0 };
}

export function useConfig() {
  return useQuery<SiteConfig>({ queryKey: ["/api/config"], staleTime: 5 * 60_000 });
}
