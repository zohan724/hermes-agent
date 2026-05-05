import type { FoodItem, MealLog } from "./data";
import {
  NUTRITION_STORAGE_KEYS,
  createLocalNutritionRepo,
  createMemoryStorage,
  defaultNutritionSeed,
  getBrowserStorage,
  type NutritionSeed,
  type StorageLike,
} from "./local-nutrition-repo";
import type { NutritionProfile, NutritionRepository, NutritionSnapshot } from "./nutrition-service";

export type RemoteNutritionPayload = {
  profile: NutritionProfile | null;
  logs: MealLog[];
  customFoods: FoodItem[];
  recentSearches: string[];
};

export type NutritionRemoteGateway = {
  load(email: string): Promise<RemoteNutritionPayload | null>;
  save(snapshot: NutritionSnapshot): Promise<void>;
};

export function createRemoteNutritionRepo({
  seed = defaultNutritionSeed,
  storage = getBrowserStorage() ?? createMemoryStorage(),
  gateway,
}: {
  seed?: NutritionSeed;
  storage?: StorageLike;
  gateway?: NutritionRemoteGateway;
}): NutritionRepository {
  const local = createLocalNutritionRepo({ storage, seed });
  let syncQueue = Promise.resolve();

  const enqueueSync = () => {
    const email = local.getSnapshot().auth.email;
    if (!gateway || !email) return;
    syncQueue = syncQueue
      .catch(() => undefined)
      .then(async () => {
        await gateway.save(local.getSnapshot());
      });
  };

  const persistLoadedPayload = (email: string, payload: RemoteNutritionPayload) => {
    storage.setItem(NUTRITION_STORAGE_KEYS.auth, "true");
    storage.setItem(NUTRITION_STORAGE_KEYS.authEmail, email);
    if (payload.profile) {
      storage.setItem(NUTRITION_STORAGE_KEYS.profile, JSON.stringify(payload.profile));
    } else {
      storage.removeItem(NUTRITION_STORAGE_KEYS.profile);
    }
    storage.setItem(NUTRITION_STORAGE_KEYS.logs, JSON.stringify(payload.logs));
    storage.setItem(NUTRITION_STORAGE_KEYS.customFoods, JSON.stringify(payload.customFoods));
    storage.setItem(NUTRITION_STORAGE_KEYS.recentSearches, JSON.stringify(payload.recentSearches));
  };

  return {
    getSnapshot() {
      return local.getSnapshot();
    },
    setSession(auth) {
      local.setSession(auth);
      enqueueSync();
    },
    saveProfile(profile) {
      local.saveProfile(profile);
      enqueueSync();
    },
    saveCustomFood(food) {
      local.saveCustomFood(food);
      enqueueSync();
    },
    recordSearch(keyword) {
      local.recordSearch(keyword);
      enqueueSync();
    },
    addLog(log) {
      local.addLog(log);
      enqueueSync();
    },
    saveLogs(logs) {
      local.saveLogs(logs);
      enqueueSync();
    },
    async hydrate() {
      const email = local.getSnapshot().auth.email;
      if (!gateway || !email) return local.getSnapshot();
      const payload = await gateway.load(email);
      if (!payload) return local.getSnapshot();
      persistLoadedPayload(email, payload);
      return local.getSnapshot();
    },
    async flush() {
      await syncQueue;
    },
  };
}

function encodeFilter(value: string): string {
  return encodeURIComponent(`eq.${value}`);
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase nutrition request failed: ${response.status} ${text}`);
  }
  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export function createSupabaseNutritionGateway({
  url,
  anonKey,
  fetchImpl = fetch,
}: {
  url: string;
  anonKey: string;
  fetchImpl?: typeof fetch;
}): NutritionRemoteGateway {
  const baseUrl = `${url.replace(/\/$/, "")}/rest/v1`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  };

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers ?? {}),
      },
    });
    return parseJson<T>(response);
  }

  async function clearCollection(table: string, email: string) {
    await request<unknown>(`/${table}?user_email=${encodeFilter(email)}`, { method: "DELETE" });
  }

  return {
    async load(email) {
      const [profiles, logs, customFoods, searches] = await Promise.all([
        request<Array<{ email: string; goal: NutritionProfile["goal"]; calorie_target: number; protein_target: number; carb_target: number }>>(
          `/nutrition_profiles?email=${encodeFilter(email)}&select=email,goal,calorie_target,protein_target,carb_target`,
        ),
        request<Array<{ id: string; meal_type: MealLog["mealType"]; food: FoodItem; created_at: string }>>(
          `/nutrition_logs?user_email=${encodeFilter(email)}&select=id,meal_type,food,created_at&order=created_at.desc`,
        ),
        request<Array<{ id: string; food: FoodItem }>>(
          `/nutrition_custom_foods?user_email=${encodeFilter(email)}&select=id,food&order=created_at.desc`,
        ),
        request<Array<{ user_email: string; searches: string[] }>>(
          `/nutrition_recent_searches?user_email=${encodeFilter(email)}&select=user_email,searches`,
        ),
      ]);

      const profileRow = profiles[0] ?? null;
      return {
        profile: profileRow
          ? {
              email: profileRow.email,
              goal: profileRow.goal,
              calorieTarget: profileRow.calorie_target,
              proteinTarget: profileRow.protein_target,
              carbTarget: profileRow.carb_target,
            }
          : null,
        logs: logs.map((row) => ({
          id: row.id,
          mealType: row.meal_type,
          food: row.food,
          createdAt: row.created_at,
        })),
        customFoods: customFoods.map((row) => row.food),
        recentSearches: searches[0]?.searches ?? [],
      };
    },
    async save(snapshot) {
      const email = snapshot.auth.email;
      if (!email) return;

      if (snapshot.profile) {
        await request<unknown>("/nutrition_profiles", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify([
            {
              email,
              goal: snapshot.profile.goal,
              calorie_target: snapshot.profile.calorieTarget,
              protein_target: snapshot.profile.proteinTarget,
              carb_target: snapshot.profile.carbTarget,
            },
          ]),
        });
      }

      await request<unknown>("/nutrition_recent_searches", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify([{ user_email: email, searches: snapshot.recentSearches }]),
      });

      await Promise.all([
        clearCollection("nutrition_logs", email),
        clearCollection("nutrition_custom_foods", email),
      ]);

      if (snapshot.logs.length > 0) {
        await request<unknown>("/nutrition_logs", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify(
            snapshot.logs.map((log) => ({
              id: log.id,
              user_email: email,
              meal_type: log.mealType,
              food: log.food,
              created_at: log.createdAt,
            })),
          ),
        });
      }

      if (snapshot.customFoods.length > 0) {
        await request<unknown>("/nutrition_custom_foods", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify(
            snapshot.customFoods.map((food) => ({
              id: food.id,
              user_email: email,
              food,
              created_at: food.createdAt ?? new Date().toISOString(),
            })),
          ),
        });
      }
    },
  };
}
