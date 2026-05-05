import {
  createLocalNutritionRepo,
  createMemoryStorage,
  defaultNutritionSeed,
  getBrowserStorage,
  type NutritionSeed,
  type StorageLike,
} from "./local-nutrition-repo";
import { createRemoteNutritionRepo, createSupabaseNutritionGateway } from "./remote-nutrition-repo";
import type { NutritionRepository } from "./nutrition-service";

export type NutritionRepoMode = "local" | "remote";

export function getPreferredNutritionRepoMode(env: Record<string, string | undefined> = {}): NutritionRepoMode {
  return env.VITE_NUTRITION_REPO_MODE === "remote" ? "remote" : "local";
}

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
}

export function getSupabaseNutritionConfig(env: Record<string, string | undefined> = {}) {
  const rawUrl = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !anonKey) return null;
  return { url: normalizeSupabaseUrl(rawUrl), anonKey };
}

export function createNutritionRepository({
  mode = "local",
  seed = defaultNutritionSeed,
  storage,
}: {
  mode?: NutritionRepoMode;
  seed?: NutritionSeed;
  storage?: StorageLike;
}): NutritionRepository {
  const resolvedStorage = storage ?? getBrowserStorage() ?? createMemoryStorage();

  if (mode === "remote") {
    const config = getSupabaseNutritionConfig(import.meta.env as Record<string, string | undefined>);
    return createRemoteNutritionRepo({
      seed,
      storage: resolvedStorage,
      gateway: config ? createSupabaseNutritionGateway(config) : undefined,
    });
  }

  return createLocalNutritionRepo({
    storage: resolvedStorage,
    seed,
  });
}
