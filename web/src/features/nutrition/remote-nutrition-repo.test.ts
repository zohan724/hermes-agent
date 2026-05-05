import { describe, expect, it, vi } from "vitest";
import type { FoodItem, MealLog } from "./data";
import { createMemoryStorage, defaultNutritionSeed } from "./local-nutrition-repo";
import {
  createRemoteNutritionRepo,
  createSupabaseNutritionGateway,
  type NutritionRemoteGateway,
} from "./remote-nutrition-repo";
import type { NutritionProfile, NutritionSnapshot } from "./nutrition-service";

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

const remoteFood: FoodItem = {
  id: "remote-chicken",
  name: "遠端雞胸",
  brand: "Remote",
  calories: 140,
  protein: 25,
  carbs: 1,
  serving: "100g",
  category: "packaged",
  sourceType: "user",
  createdAt: "2026-05-02T08:00:00.000Z",
};

const profile: NutritionProfile = {
  email: "zohan@example.com",
  goal: "減脂",
  calorieTarget: 1700,
  proteinTarget: 130,
  carbTarget: 180,
};

function makeLog(food: FoodItem, createdAt: string, mealType: MealLog["mealType"] = "午餐"): MealLog {
  return { id: `${food.id}-${createdAt}`, mealType, food, createdAt };
}

describe("createRemoteNutritionRepo", () => {
  it("hydrates cached state from remote gateway for the signed-in email", async () => {
    const gateway: NutritionRemoteGateway = {
      load: vi.fn(async (email) => {
        expect(email).toBe("zohan@example.com");
        return {
          profile,
          logs: [makeLog(remoteFood, "2026-05-02T12:00:00.000Z")],
          customFoods: [remoteFood],
          recentSearches: ["雞胸"],
        };
      }),
      save: vi.fn(async () => {}),
    };

    const repo = createRemoteNutritionRepo({
      seed: defaultNutritionSeed,
      storage: createMemoryStorage(),
      gateway,
    });

    repo.setSession({ authed: true, email: "zohan@example.com" });
    const snapshot = await repo.hydrate!();

    expect(snapshot.profile).toEqual(profile);
    expect(snapshot.logs[0].food.id).toBe(remoteFood.id);
    expect(snapshot.customFoods[0].id).toBe(remoteFood.id);
    expect(snapshot.recentSearches).toEqual(["雞胸"]);
    expect(repo.getSnapshot().foodCatalog[0].id).toBe(remoteFood.id);
  });

  it("persists local changes back to the remote gateway", async () => {
    const save = vi.fn(async (_snapshot: NutritionSnapshot) => {});
    const repo = createRemoteNutritionRepo({
      seed: defaultNutritionSeed,
      storage: createMemoryStorage(),
      gateway: {
        load: vi.fn(async () => null),
        save,
      },
    });

    repo.setSession({ authed: true, email: profile.email });
    repo.saveProfile(profile);
    repo.saveCustomFood(customFood);
    repo.recordSearch("豆奶");
    repo.addLog(makeLog(customFood, "2026-05-03T08:00:00.000Z", "早餐"));
    await repo.flush!();

    expect(save).toHaveBeenCalled();
    const lastSnapshot = save.mock.calls.at(-1)?.[0] as NutritionSnapshot;
    expect(lastSnapshot.auth.email).toBe(profile.email);
    expect(lastSnapshot.profile?.goal).toBe("減脂");
    expect(lastSnapshot.customFoods[0].id).toBe(customFood.id);
    expect(lastSnapshot.logs[0].food.id).toBe(customFood.id);
    expect(lastSnapshot.recentSearches[0]).toBe("豆奶");
  });

  it("treats empty Supabase write responses as success during save", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      if (url.includes("nutrition_profiles") || url.includes("nutrition_recent_searches") || url.includes("nutrition_logs") || url.includes("nutrition_custom_foods")) {
        return new Response(null, { status: 201 });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const gateway = createSupabaseNutritionGateway({
      url: "https://demo.supabase.co",
      anonKey: "public-anon-key",
      fetchImpl,
    });

    await expect(
      gateway.save({
        auth: { authed: true, email: profile.email },
        profile,
        logs: [makeLog(customFood, "2026-05-03T08:00:00.000Z", "早餐")],
        customFoods: [customFood],
        recentSearches: ["豆奶"],
        foodCatalog: [customFood],
        frequentFoods: [customFood],
      }),
    ).resolves.toBeUndefined();
  });
});
