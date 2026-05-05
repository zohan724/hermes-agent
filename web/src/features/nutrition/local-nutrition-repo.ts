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
    aliases: ["御飯糰", "鮪魚御飯糰"],
    tags: ["超商", "便利商店", "7-11", "早餐"],
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
    aliases: ["豆漿", "無加糖豆漿"],
    tags: ["超商", "便利商店", "早餐", "飲料"],
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
    aliases: ["香蕉一根"],
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
    aliases: ["雞胸三明治", "雞肉三明治"],
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
    aliases: ["雞胸肉", "雞胸"],
    barcode: "4710304444444",
    sourceType: "barcode",
  },
  {
    id: "tea-egg",
    name: "茶葉蛋",
    brand: "便利商店",
    calories: 78,
    protein: 6.5,
    carbs: 1.5,
    serving: "1 顆",
    category: "packaged",
    aliases: ["滷蛋", "蛋"],
    tags: ["超商", "便利商店", "早餐", "蛋白質"],
    sourceType: "curated",
  },
  {
    id: "greek-yogurt",
    name: "希臘優格",
    brand: "便利商店",
    calories: 146,
    protein: 12,
    carbs: 14,
    serving: "1 杯 (200g)",
    category: "packaged",
    aliases: ["優格", "高蛋白優格"],
    sourceType: "curated",
  },
  {
    id: "sweet-potato",
    name: "烤地瓜",
    brand: "便利商店",
    calories: 160,
    protein: 2.5,
    carbs: 37,
    serving: "1 條 (180g)",
    category: "packaged",
    aliases: ["地瓜", "夯番薯"],
    sourceType: "curated",
  },
  {
    id: "protein-milk",
    name: "高蛋白牛奶",
    brand: "光泉",
    calories: 195,
    protein: 20,
    carbs: 14,
    serving: "1 瓶 (375ml)",
    category: "drink",
    aliases: ["高蛋白飲", "蛋白牛奶"],
    sourceType: "curated",
  },
  {
    id: "chicken-salad",
    name: "舒肥雞胸沙拉",
    brand: "7-ELEVEN",
    calories: 210,
    protein: 22,
    carbs: 14,
    serving: "1 盒",
    category: "meal",
    aliases: ["雞胸沙拉", "沙拉"],
    sourceType: "curated",
  },
  {
    id: "beef-bento",
    name: "牛肉便當",
    brand: "台式便當",
    calories: 720,
    protein: 32,
    carbs: 82,
    serving: "1 份",
    category: "meal",
    aliases: ["便當", "牛肉飯"],
    sourceType: "curated",
  },
  {
    id: "chicken-lunchbox",
    name: "雞胸健康餐盒",
    brand: "健康餐盒",
    calories: 510,
    protein: 38,
    carbs: 48,
    serving: "1 盒",
    category: "meal",
    aliases: ["健康餐", "雞胸便當"],
    sourceType: "template",
  },
  {
    id: "braised-pork-rice",
    name: "滷肉飯",
    brand: "台式小吃",
    calories: 430,
    protein: 12,
    carbs: 57,
    serving: "1 碗",
    category: "meal",
    aliases: ["魯肉飯", "肉燥飯"],
    sourceType: "curated",
  },
  {
    id: "beef-noodle",
    name: "牛肉麵",
    brand: "台式麵店",
    calories: 620,
    protein: 28,
    carbs: 72,
    serving: "1 碗",
    category: "meal",
    aliases: ["紅燒牛肉麵", "麵"],
    sourceType: "curated",
  },
  {
    id: "scallion-pancake-egg",
    name: "蛋餅",
    brand: "早餐店",
    calories: 285,
    protein: 11,
    carbs: 30,
    serving: "1 份",
    category: "meal",
    aliases: ["蔥抓蛋餅", "早餐蛋餅"],
    tags: ["早餐店", "早餐", "台式早餐"],
    sourceType: "curated",
  },
  {
    id: "latte-unsweetened",
    name: "無糖拿鐵",
    brand: "咖啡店",
    calories: 128,
    protein: 8,
    carbs: 10,
    serving: "1 杯 (中杯)",
    category: "drink",
    aliases: ["拿鐵", "冰拿鐵"],
    sourceType: "curated",
  },
  {
    id: "black-tea-unsweetened",
    name: "無糖紅茶",
    brand: "手搖飲",
    calories: 0,
    protein: 0,
    carbs: 0,
    serving: "1 杯 (700ml)",
    category: "drink",
    aliases: ["紅茶", "冰紅茶"],
    tags: ["手搖飲", "飲料", "無糖"],
    sourceType: "curated",
  },
  {
    id: "milk-tea-half-sugar",
    name: "半糖珍珠奶茶",
    brand: "手搖飲",
    calories: 430,
    protein: 5,
    carbs: 72,
    serving: "1 杯 (700ml)",
    category: "drink",
    aliases: ["珍奶", "奶茶"],
    tags: ["手搖飲", "飲料", "含糖"],
    sourceType: "curated",
  },
  {
    id: "salmon-onigiri",
    name: "鮭魚飯糰",
    brand: "7-ELEVEN",
    calories: 236,
    protein: 9,
    carbs: 39,
    serving: "1 個 (105g)",
    category: "packaged",
    aliases: ["鮭魚御飯糰", "鮭魚御飯團"],
    sourceType: "curated",
  },
  {
    id: "chicken-rice",
    name: "雞肉飯",
    brand: "台式小吃",
    calories: 360,
    protein: 15,
    carbs: 48,
    serving: "1 碗",
    category: "meal",
    aliases: ["嘉義雞肉飯", "雞絲飯"],
    sourceType: "curated",
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
