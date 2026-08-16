import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Used from client components (review form autosave, etc).
export const supabaseBrowser = () => createClient(url, anonKey);

// Used from API routes / server components — service role bypasses RLS,
// which is fine here since demo mode has no auth and RLS is already open.
export const supabaseServer = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, serviceKey || anonKey);
};

// Anonymous per-browser identifier so "session_id" in career_profiles has
// something to key on without building real auth for the MVP.
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";
  const key = "pauseresume_session_id";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}
