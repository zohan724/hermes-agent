import { describe, expect, it } from "vitest";
import type { FoodItem, MealLog } from "./data";
import {
  createNutritionService,
  type NutritionRepository,
  type NutritionProfile,
  type NutritionSnapshot,
} from "./nutrition-service";

const baseFood: FoodItem = {
  id: "soy-milk",
  name: "無糖豆漿",
  brand: "光泉",
  calories: 80,
  protein: 7,
  carbs: 8,
  serving: "240ml",
  category: "drink",
  barcode: "222",
  sourceType: "curated",
};

const customFood: FoodItem = {
  id: "custom-soy",
  name: "自建高蛋白豆奶",
  brand: "PX Mart",
  calories: 168,
  protein: 18,
  carbs: 14,
  serving: "375ml",
  category: "drink",
  barcode: "999",
  sourceType: "user",
  createdAt: "2026-05-01T10:00:00.000Z",
};

const profile: NutritionProfile = {
  email: "zohan@example.com",
  goal: "減脂",
  calorieTarget: 1700,
  proteinTarget: 130,
  carbTarget: 180,
};

function makeLog(food: FoodItem, createdAt: string, mealType: MealLog["mealType"] = "早餐"): MealLog {
  return { id: `${food.id}-${createdAt}`, mealType, food, createdAt };
}

function createStubRepo(snapshot?: Partial<NutritionSnapshot>): NutritionRepository {
  let current: NutritionSnapshot = {
    auth: { authed: false, email: null },
    profile: null,
    logs: [makeLog(baseFood, "2026-04-30T08:00:00.000Z")],
    customFoods: [],
    recentSearches: [],
    foodCatalog: [baseFood],
    frequentFoods: [baseFood],
    ...snapshot,
  };

  return {
    getSnapshot: () => current,
    setSession(auth) {
      current = { ...current, auth };
    },
    saveProfile(nextProfile) {
      current = { ...current, profile: nextProfile };
    },
    saveCustomFood(food) {
      current = {
        ...current,
        customFoods: [food, ...current.customFoods],
        foodCatalog: [food, ...current.foodCatalog],
      };
    },
    recordSearch(keyword) {
      current = {
        ...current,
        recentSearches: [keyword, ...current.recentSearches.filter((item) => item !== keyword)].slice(0, 6),
      };
    },
    addLog(log) {
      current = { ...current, logs: [log, ...current.logs], frequentFoods: [log.food, ...current.frequentFoods] };
    },
    saveLogs(logs) {
      current = { ...current, logs };
    },
  };
}

describe("createNutritionService", () => {
  it("returns current snapshot and derives scan result by barcode lookup", () => {
    const service = createNutritionService(createStubRepo({ foodCatalog: [baseFood, customFood] }));

    expect(service.getSnapshot().foodCatalog).toHaveLength(2);
    expect(service.findFoodByBarcode("999")?.id).toBe("custom-soy");
    expect(service.findFoodByBarcode("404")).toBeUndefined();
  });

  it("login, onboarding, OCR draft, and log writes go through service methods", () => {
    const service = createNutritionService(createStubRepo());

    service.completeLogin("zohan@example.com");
    service.saveProfile(profile);
    service.saveCustomFood(customFood);
    service.recordSearch("豆奶");
    service.addLog(makeLog(customFood, "2026-05-02T12:00:00.000Z", "午餐"));

    const snapshot = service.getSnapshot();
    expect(snapshot.auth.authed).toBe(true);
    expect(snapshot.auth.email).toBe("zohan@example.com");
    expect(snapshot.profile?.email).toBe("zohan@example.com");
    expect(snapshot.customFoods[0].id).toBe("custom-soy");
    expect(snapshot.recentSearches[0]).toBe("豆奶");
    expect(snapshot.logs[0].food.id).toBe("custom-soy");
  });
});
