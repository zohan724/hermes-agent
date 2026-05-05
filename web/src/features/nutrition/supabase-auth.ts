import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseNutritionConfig } from "./repo-factory";

type SessionEmail = string | null;

type AuthSubscription = {
  unsubscribe(): void;
};

export type SupabaseAuthClientLike = {
  auth: {
    signInWithOAuth(args: {
      provider: "google";
      options: { redirectTo: string; skipBrowserRedirect: boolean };
    }): Promise<{ data: { url?: string | null }; error: { message: string } | null }>;
    signOut(): Promise<{ error: { message: string } | null }>;
    getSession(): Promise<{
      data: { session: { user: { email?: string | null } } | null };
      error: { message: string } | null;
    }>;
    onAuthStateChange(
      callback: (_event: string, session: { user: { email?: string | null } } | null) => void,
    ): { data: { subscription: AuthSubscription } };
  };
};

async function assertOAuthUrlIsUsable(url: string, fetchImpl: typeof fetch): Promise<void> {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "manual",
    headers: { apikey: new URL(url).searchParams.get("apikey") ?? "" },
  });
  if (response.status < 400) return;

  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { msg?: string };
    throw new Error(parsed.msg ?? "Google 登入目前不可用");
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(text || "Google 登入目前不可用");
    }
    throw error;
  }
}

export function isSupabaseAuthConfigured(env: Record<string, string | undefined>): boolean {
  return getSupabaseNutritionConfig(env) !== null;
}

export function createSupabaseBrowserClient(env: Record<string, string | undefined>): SupabaseClient | null {
  const config = getSupabaseNutritionConfig(env);
  if (!config) return null;
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

function requireNoAuthError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function createSupabaseGoogleAuth(client: SupabaseAuthClientLike, fetchImpl: typeof fetch = fetch) {
  return {
    async signInWithGoogle(redirectTo: string): Promise<void> {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      requireNoAuthError(error);
      if (!data.url) throw new Error("Google OAuth redirect URL 缺失");
      await assertOAuthUrlIsUsable(data.url, fetchImpl);
      if (typeof window !== "undefined") {
        window.location.assign(data.url);
      }
    },
    async signOut(): Promise<void> {
      const { error } = await client.auth.signOut();
      requireNoAuthError(error);
    },
    async getSessionEmail(): Promise<SessionEmail> {
      const { data, error } = await client.auth.getSession();
      requireNoAuthError(error);
      return data.session?.user.email ?? null;
    },
    onAuthStateChange(callback: (email: SessionEmail) => void): AuthSubscription {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        callback(session?.user.email ?? null);
      });
      return data.subscription;
    },
  };
}