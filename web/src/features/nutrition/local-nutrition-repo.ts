import {
  buildFoodCatalog,
  deriveFrequentFoods,
  recordRecentSearch,
  type FoodItem,
  type MealLog,
} from "./data";
import type { NutritionProfile, NutritionRepository, NutritionSnapshot } from "./nutrition-service";

export type NutritionSeed = {
  foods: FoodItem[];
  logs: MealLog[];
  defaultProfile: NutritionProfile | null;
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const NUTRITION_STORAGE_KEYS = {
  auth: "nutrition-mvp-auth-v1",
  authEmail: "nutrition-mvp-auth-email-v1",
  profile: "nutrition-mvp-profile-v1",
  logs: "nutrition-mvp-logs-v1",
  customFoods: "nutrition-mvp-custom-foods-v1",
  recentSearches: "nutrition-mvp-recent-searches-v1",
} as const;

const demoFoods: FoodItem[] = [
  {
    id: "tuna-onigiri",
    name: "鮪魚飯糰",
    brand: "7-ELEVEN",
    calories: 250,
    protein: 12,
    carbs: 38,
    serving: "1 個 (110g)",
    category: "packaged",
    barcode: "4710010011111",
    sourceType: "barcode",
  },
  {
    id: "soy-milk",
    name: "無糖豆漿",
    brand: "光泉",
    calories: 80,
    protein: 7,
    carbs: 8,
    serving: "240 ml",
    category: "drink",
    barcode: "4710102222222",
    sourceType: "curated",
  },
  {
    id: "banana",
    name: "香蕉",
    calories: 105,
    protein: 1,
    carbs: 27,
    serving: "1 根（中）",
    category: "fruit",
    sourceType: "curated",
  },
  {
    id: "sandwich",
    name: "舒肥雞胸三明治",
    brand: "FamilyMart",
    calories: 321,
    protein: 23,
    carbs: 28,
    serving: "每包 1 份 (185g)",
    category: "packaged",
    barcode: "4710203333333",
    sourceType: "barcode",
  },
  {
    id: "chicken-breast",
    name: "舒肥雞胸",
    brand: "7-ELEVEN",
    calories: 142,
    protein: 24,
    carbs: 2,
    serving: "1 包 (100g)",
    category: "packaged",
    barcode: "4710304444444",
    sourceType: "barcode",
  },
];

function makeSeedLog(food: FoodItem, mealType: MealLog["mealType"], createdAt: string): MealLog {
  return { id: `${food.id}-${createdAt}`, food, mealType, createdAt };
}

export const defaultNutritionSeed: NutritionSeed = {
  foods: demoFoods,
  logs: [
    makeSeedLog(demoFoods[0], "早餐", "2026-04-30T08:00:00.000Z"),
    makeSeedLog(demoFoods[1], "早餐", "2026-04-30T08:05:00.000Z"),
    makeSeedLog(demoFoods[2], "早餐", "2026-04-30T08:10:00.000Z"),
  ],
  defaultProfile: null,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function deriveSnapshot(storage: StorageLike, seed: NutritionSeed): NutritionSnapshot {
  const authed = storage.getItem(NUTRITION_STORAGE_KEYS.auth) === "true";
  const profile = safeParse<NutritionProfile | null>(storage.getItem(NUTRITION_STORAGE_KEYS.profile), seed.defaultProfile);
  const storedLogs = storage.getItem(NUTRITION_STORAGE_KEYS.logs);
  const logs = storedLogs === null ? seed.logs : safeParse<MealLog[]>(storedLogs, []);
  const customFoods = safeParse<FoodItem[]>(storage.getItem(NUTRITION_STORAGE_KEYS.customFoods), []);
  const recentSearches = safeParse<string[]>(storage.getItem(NUTRITION_STORAGE_KEYS.recentSearches), []);
  const foodCatalog = buildFoodCatalog(seed.foods, customFoods);
  const frequentFoods = deriveFrequentFoods(logs, 4);

  return {
    auth: { authed, email: storage.getItem(NUTRITION_STORAGE_KEYS.authEmail) },
    profile,
    logs,
    customFoods,
    recentSearches,
    foodCatalog,
    frequentFoods,
  };
}

export function createLocalNutritionRepo({ storage, seed }: { storage: StorageLike; seed: NutritionSeed }): NutritionRepository {
  const getSnapshot = () => deriveSnapshot(storage, seed);

  return {
    getSnapshot,
    setSession(auth) {
      storage.setItem(NUTRITION_STORAGE_KEYS.auth, auth.authed ? "true" : "false");
      if (auth.email) {
        storage.setItem(NUTRITION_STORAGE_KEYS.authEmail, auth.email);
      } else {
        storage.removeItem(NUTRITION_STORAGE_KEYS.authEmail);
        storage.removeItem(NUTRITION_STORAGE_KEYS.profile);
        storage.setItem(NUTRITION_STORAGE_KEYS.logs, JSON.stringify([]));
        storage.removeItem(NUTRITION_STORAGE_KEYS.customFoods);
        storage.removeItem(NUTRITION_STORAGE_KEYS.recentSearches);
      }
    },
    saveProfile(profile: NutritionProfile | null) {
      if (!profile) {
        storage.removeItem(NUTRITION_STORAGE_KEYS.profile);
        return;
      }
      storage.setItem(NUTRITION_STORAGE_KEYS.profile, JSON.stringify(profile));
    },
    saveCustomFood(food: FoodItem) {
      const snapshot = getSnapshot();
      storage.setItem(NUTRITION_STORAGE_KEYS.customFoods, JSON.stringify([food, ...snapshot.customFoods]));
    },
    recordSearch(keyword: string) {
      const snapshot = getSnapshot();
      storage.setItem(NUTRITION_STORAGE_KEYS.recentSearches, JSON.stringify(recordRecentSearch(snapshot.recentSearches, keyword)));
    },
    addLog(log: MealLog) {
      const snapshot = getSnapshot();
      storage.setItem(NUTRITION_STORAGE_KEYS.logs, JSON.stringify([log, ...snapshot.logs]));
    },
    saveLogs(logs: MealLog[]) {
      storage.setItem(NUTRITION_STORAGE_KEYS.logs, JSON.stringify(logs));
    },
  };
}

export function createMemoryStorage(initial?: Record<string, string>): StorageLike {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

export function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}
