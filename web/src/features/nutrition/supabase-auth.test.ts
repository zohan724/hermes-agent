import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseGoogleAuth,
  isSupabaseAuthConfigured,
  type SupabaseAuthClientLike,
} from "./supabase-auth";

describe("supabase Google auth helpers", () => {
  it("reports auth as unavailable when public Supabase env vars are missing", () => {
    expect(isSupabaseAuthConfigured({})).toBe(false);
    expect(isSupabaseAuthConfigured({ VITE_SUPABASE_URL: "https://demo.supabase.co" })).toBe(false);
    expect(
      isSupabaseAuthConfigured({
        VITE_SUPABASE_URL: "https://demo.supabase.co",
        VITE_SUPABASE_ANON_KEY: "public-anon-key",
      }),
    ).toBe(true);
  });

  it("starts Google OAuth with a redirect back to the nutrition page", async () => {
    const signInWithOAuth = vi.fn(async () => ({ data: { url: "https://accounts.google.com/mock" }, error: null }));
    const assign = vi.fn();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302 }));
    vi.stubGlobal("window", { location: { assign } });
    const auth = createSupabaseGoogleAuth(
      {
        auth: {
          signInWithOAuth,
          signOut: vi.fn(async () => ({ error: null })),
          getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
          onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
      } as unknown as SupabaseAuthClientLike,
      fetchImpl as typeof fetch,
    );

    await auth.signInWithGoogle("http://127.0.0.1:4173/nutrition-mvp");

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://127.0.0.1:4173/nutrition-mvp", skipBrowserRedirect: true },
    });
    expect(assign).toHaveBeenCalledWith("https://accounts.google.com/mock");
    vi.unstubAllGlobals();
  });

  it("surfaces a readable error when the Google provider is disabled in Supabase", async () => {
    const auth = createSupabaseGoogleAuth(
      {
        auth: {
          signInWithOAuth: vi.fn(async () => ({ data: { url: "https://demo.supabase.co/auth/v1/authorize?provider=google" }, error: null })),
          signOut: vi.fn(async () => ({ error: null })),
          getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
          onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
      } as unknown as SupabaseAuthClientLike,
      vi.fn(async () =>
        new Response(
          JSON.stringify({ msg: "Unsupported provider: provider is not enabled" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch,
    );

    await expect(auth.signInWithGoogle("http://127.0.0.1:4173/nutrition-mvp")).rejects.toThrow(
      "Unsupported provider: provider is not enabled",
    );
  });

  it("extracts the signed-in email from the Supabase session", async () => {
    const auth = createSupabaseGoogleAuth({
      auth: {
        signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
        signOut: vi.fn(async () => ({ error: null })),
        getSession: vi.fn(async () => ({
          data: { session: { user: { email: "zohan@example.com" } } },
          error: null,
        })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    } as unknown as SupabaseAuthClientLike);

    await expect(auth.getSessionEmail()).resolves.toBe("zohan@example.com");
  });
});