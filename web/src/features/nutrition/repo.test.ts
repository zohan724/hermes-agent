import { describe, expect, it } from "vitest";
import type { FoodItem } from "./data";
import {
  createLocalNutritionRepo,
  createMemoryStorage,
  defaultNutritionSeed,
} from "./local-nutrition-repo";
import type { NutritionProfile } from "./nutrition-service";

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

describe("createLocalNutritionRepo", () => {
  it("hydrates default snapshot when storage is empty", () => {
    const repo = createLocalNutritionRepo({
      storage: createMemoryStorage(),
      seed: defaultNutritionSeed,
    });

    const snapshot = repo.getSnapshot();

    expect(snapshot.auth.authed).toBe(false);
    expect(snapshot.auth.email).toBe(null);
    expect(snapshot.logs.length).toBeGreaterThan(0);
    expect(snapshot.foodCatalog.length).toBeGreaterThan(snapshot.customFoods.length);
  });

  it("persists auth/profile and custom foods into snapshot", () => {
    const storage = createMemoryStorage();
    const repo = createLocalNutritionRepo({ storage, seed: defaultNutritionSeed });

    repo.setSession({ authed: true, email: profile.email });
    repo.saveProfile(profile);
    repo.saveCustomFood(customFood);

    const snapshot = repo.getSnapshot();

    expect(snapshot.auth.authed).toBe(true);
    expect(snapshot.auth.email).toBe(profile.email);
    expect(snapshot.profile).toEqual(profile);
    expect(snapshot.customFoods[0]).toEqual(customFood);
    expect(snapshot.foodCatalog[0].id).toBe(customFood.id);
  });

  it("records recent searches and prepends new meal logs", () => {
    const repo = createLocalNutritionRepo({
      storage: createMemoryStorage(),
      seed: defaultNutritionSeed,
    });

    repo.recordSearch("飯糰");
    repo.recordSearch("豆漿");
    repo.recordSearch("飯糰");

    repo.addLog({
      id: "new-log",
      mealType: "午餐",
      food: customFood,
      createdAt: "2026-05-02T12:00:00.000Z",
    });

    const snapshot = repo.getSnapshot();

    expect(snapshot.recentSearches).toEqual(["飯糰", "豆漿"]);
    expect(snapshot.logs[0].id).toBe("new-log");
    expect(snapshot.frequentFoods[0].id).toBe(customFood.id);
  });

  it("can be re-created from the same storage and keep prior state", () => {
    const storage = createMemoryStorage();
    const firstRepo = createLocalNutritionRepo({ storage, seed: defaultNutritionSeed });

    firstRepo.setSession({ authed: true, email: profile.email });
    firstRepo.saveProfile(profile);
    firstRepo.saveCustomFood(customFood);
    firstRepo.recordSearch("豆奶");

    const secondRepo = createLocalNutritionRepo({ storage, seed: defaultNutritionSeed });
    const snapshot = secondRepo.getSnapshot();

    expect(snapshot.auth.authed).toBe(true);
    expect(snapshot.auth.email).toBe(profile.email);
    expect(snapshot.profile?.email).toBe(profile.email);
    expect(snapshot.customFoods.some((food) => food.id === customFood.id)).toBe(true);
    expect(snapshot.recentSearches[0]).toBe("豆奶");
  });

  it("respects an explicitly persisted empty logs array instead of falling back to seed demo logs", () => {
    const storage = createMemoryStorage({
      "nutrition-mvp-logs-v1": JSON.stringify([]),
    });
    const repo = createLocalNutritionRepo({ storage, seed: defaultNutritionSeed });

    expect(repo.getSnapshot().logs).toEqual([]);
  });

  it("clears persisted user data on logout so the next login starts clean", () => {
    const storage = createMemoryStorage();
    const repo = createLocalNutritionRepo({ storage, seed: defaultNutritionSeed });

    repo.setSession({ authed: true, email: profile.email });
    repo.saveProfile(profile);
    repo.saveCustomFood(customFood);
    repo.recordSearch("豆奶");
    repo.saveLogs([]);
    repo.setSession({ authed: false, email: null });

    const snapshot = repo.getSnapshot();
    expect(snapshot.auth).toEqual({ authed: false, email: null });
    expect(snapshot.profile).toBe(null);
    expect(snapshot.customFoods).toEqual([]);
    expect(snapshot.recentSearches).toEqual([]);
    expect(snapshot.logs).toEqual([]);
  });
});
