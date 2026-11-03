import { useSuspenseQuery } from "@tanstack/react-query";
import { getJSON } from "./client";

export type Session = { operator: string; lang: string; version: string; sql: boolean };
export type Branding = {
  title: string;
  subtitle: string;
  phrase: string;
  logo: string;
  attribution: string;
  css: string;
};

// Both are read once per visit: who is looking and whose console this is do
// not change while a tab is open. A missing session is handled where the
// client sees it (client.ts), not here.
const forever = { staleTime: Infinity, gcTime: Infinity } as const;

export const useSession = () =>
  useSuspenseQuery({ queryKey: ["session"], queryFn: ({ signal }) => getJSON<Session>("/api/session", signal), ...forever }).data;

export const useBranding = () =>
  useSuspenseQuery({ queryKey: ["branding"], queryFn: ({ signal }) => getJSON<Branding>("/api/branding", signal), ...forever }).data;
