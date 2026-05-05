import { describe, expect, it } from "vitest";
import { createMemoryStorage, defaultNutritionSeed } from "./local-nutrition-repo";
import { createNutritionRepository, getPreferredNutritionRepoMode, getSupabaseNutritionConfig } from "./repo-factory";

describe("repo factory", () => {
  it("defaults to local mode and creates a writable local repo", () => {
    const repo = createNutritionRepository({
      mode: "local",
      storage: createMemoryStorage(),
      seed: defaultNutritionSeed,
    });

    repo.setSession({ authed: true, email: "zohan@example.com" });
    expect(repo.getSnapshot().auth.authed).toBe(true);
  });

  it("creates a remote repo that can stay readable while using remote sync when available", async () => {
    const repo = createNutritionRepository({
      mode: "remote",
      seed: defaultNutritionSeed,
    });

    expect(repo.getSnapshot().foodCatalog.length).toBeGreaterThan(0);
    repo.setSession({ authed: true, email: "zohan@example.com" });
    repo.saveLogs([]);
    await repo.flush?.();
    expect(repo.getSnapshot().auth.email).toBe("zohan@example.com");
  });

  it("reads preferred mode from env-like flag", () => {
    expect(getPreferredNutritionRepoMode({ VITE_NUTRITION_REPO_MODE: "remote" })).toBe("remote");
    expect(getPreferredNutritionRepoMode({ VITE_NUTRITION_REPO_MODE: "local" })).toBe("local");
    expect(getPreferredNutritionRepoMode({})).toBe("local");
  });

  it("extracts Supabase config only when both public env vars exist", () => {
    expect(getSupabaseNutritionConfig({ VITE_SUPABASE_URL: "https://demo.supabase.co" })).toBe(null);
    expect(
      getSupabaseNutritionConfig({
        VITE_SUPABASE_URL: "https://demo.supabase.co",
        VITE_SUPABASE_ANON_KEY: "public-anon-key",
      }),
    ).toEqual({ url: "https://demo.supabase.co", anonKey: "public-anon-key" });
  });

  it("normalizes a pasted Supabase REST URL back to the project base URL", () => {
    expect(
      getSupabaseNutritionConfig({
        VITE_SUPABASE_URL: "https://demo.supabase.co/rest/v1/",
        VITE_SUPABASE_ANON_KEY: "public-anon-key",
      }),
    ).toEqual({ url: "https://demo.supabase.co", anonKey: "public-anon-key" });
  });
});
