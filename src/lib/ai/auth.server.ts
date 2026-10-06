import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function authenticate(request: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!url || !key || !token || token.split(".").length !== 3) return null;
  const supabase = createClient<Database>(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub as string };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
