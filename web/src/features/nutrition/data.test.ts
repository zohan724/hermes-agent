import { describe, expect, it } from "vitest";
import {
  buildFoodCatalog,
  deriveFrequentFoods,
  lookupFoodByBarcode,
  recordRecentSearch,
  searchFoods,
  type FoodItem,
  type MealLog,
} from "./data";

const foods: FoodItem[] = [
  {
    id: "a",
    name: "鮪魚飯糰",
    brand: "7-ELEVEN",
    calories: 250,
    protein: 12,
    carbs: 38,
    serving: "1 個",
    category: "packaged",
    barcode: "111",
    sourceType: "curated",
  },
  {
    id: "b",
    name: "無糖豆漿",
    brand: "光泉",
    calories: 80,
    protein: 7,
    carbs: 8,
    serving: "240ml",
    category: "drink",
    barcode: "222",
    sourceType: "barcode",
    aliases: ["豆漿", "無加糖豆漿"],
  },
  {
    id: "c",
    name: "高蛋白豆奶",
    brand: "PX Mart",
    calories: 168,
    protein: 18,
    carbs: 14,
    serving: "375ml",
    category: "drink",
    barcode: "333",
    sourceType: "user",
    tags: ["全聯", "高蛋白"],
  },
];

function makeLog(food: FoodItem, createdAt: string, mealType: MealLog["mealType"] = "早餐"): MealLog {
  return { id: `${food.id}-${createdAt}`, food, createdAt, mealType };
}

describe("recordRecentSearch", () => {
  it("dedupes, trims whitespace, and keeps newest first with a max of 6", () => {
    const result = recordRecentSearch(["雞胸", "飯糰", "豆漿", "沙拉", "優格", "全聯"], "  飯糰 ");
    expect(result).toEqual(["飯糰", "雞胸", "豆漿", "沙拉", "優格", "全聯"]);

    const withNewKeyword = recordRecentSearch(result, "便利商店");
    expect(withNewKeyword).toEqual(["便利商店", "飯糰", "雞胸", "豆漿", "沙拉", "優格"]);
  });
});

describe("buildFoodCatalog", () => {
  it("puts newest custom foods ahead of base foods without duplicating ids", () => {
    const customFoods: FoodItem[] = [
      { ...foods[1], id: "b", name: "舊豆漿覆蓋測試" },
      { ...foods[2], createdAt: "2026-05-01T10:00:00.000Z" },
    ];

    const catalog = buildFoodCatalog(foods, customFoods);

    expect(catalog.map((food) => food.id)).toEqual(["c", "a", "b"]);
    expect(catalog.find((food) => food.id === "b")?.name).toBe("舊豆漿覆蓋測試");
  });
});

describe("searchFoods", () => {
  it("matches name, brand, aliases, and tags while prioritizing exact name matches then brand matches", () => {
    const results = searchFoods(foods, "豆");
    expect(results.map((food) => food.id)).toEqual(["b", "c"]);

    const aliasResults = searchFoods(foods, "無加糖豆漿");
    expect(aliasResults.map((food) => food.id)).toEqual(["b"]);

    const tagResults = searchFoods(foods, "全聯");
    expect(tagResults.map((food) => food.id)).toEqual(["c"]);

    const brandResults = searchFoods(foods, "7-eleven");
    expect(brandResults.map((food) => food.id)).toEqual(["a"]);
  });
});

describe("lookupFoodByBarcode", () => {
  it("finds foods by barcode from the merged catalog", () => {
    const catalog = buildFoodCatalog(foods.slice(0, 2), [foods[2]]);
    expect(lookupFoodByBarcode(catalog, "333")?.id).toBe("c");
    expect(lookupFoodByBarcode(catalog, "999")).toBeUndefined();
  });
});

describe("deriveFrequentFoods", () => {
  it("sorts by usage count then recency", () => {
    const logs = [
      makeLog(foods[1], "2026-05-01T08:00:00.000Z"),
      makeLog(foods[0], "2026-05-01T09:00:00.000Z"),
      makeLog(foods[1], "2026-05-01T10:00:00.000Z"),
      makeLog(foods[2], "2026-05-01T11:00:00.000Z"),
      makeLog(foods[0], "2026-05-01T12:00:00.000Z"),
    ];

    const frequent = deriveFrequentFoods(logs, 3);
    expect(frequent.map((food) => food.id)).toEqual(["a", "b", "c"]);
  });
});
