import { describe, expect, it } from "vitest";
import {
  buildFoodCatalog,
  deriveBusinessDayLabel,
  deriveFrequentFoods,
  deriveHomeQuickActions,
  deriveRecentFoods,
  filterLogsForBusinessDay,
  getBusinessDayKey,
  getFoodSourceMeta,
  lookupFoodByBarcode,
  recordRecentSearch,
  searchFoods,
  summarizeBusinessDay,
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

  it("supports multi-token queries across tags and food names", () => {
    const results = searchFoods(
      [
        ...foods,
        {
          id: "d",
          name: "茶葉蛋",
          brand: "7-ELEVEN",
          calories: 78,
          protein: 6.5,
          carbs: 1.5,
          serving: "1 顆",
          category: "packaged",
          sourceType: "curated",
          tags: ["超商", "高蛋白"],
        },
      ],
      "超商 蛋白",
    );

    expect(results.map((food) => food.id)).toEqual(["d"]);
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

describe("deriveRecentFoods", () => {
  it("dedupes by food id and keeps most recent first", () => {
    const logs = [
      makeLog(foods[0], "2026-05-01T08:00:00.000Z"),
      makeLog(foods[1], "2026-05-01T09:00:00.000Z"),
      makeLog(foods[0], "2026-05-01T10:00:00.000Z"),
      makeLog(foods[2], "2026-05-01T11:00:00.000Z"),
    ];

    const recent = deriveRecentFoods(logs, 3);
    expect(recent.map((food) => food.id)).toEqual(["c", "a", "b"]);
  });
});

describe("getFoodSourceMeta", () => {
  it("returns trust labels for curated, barcode, template, and user foods", () => {
    expect(getFoodSourceMeta({ ...foods[0], sourceType: "barcode" })).toMatchObject({
      label: "條碼資料庫",
      tone: "solid",
    });
    expect(getFoodSourceMeta({ ...foods[0], sourceType: "curated" })).toMatchObject({
      label: "常見食物庫",
      tone: "solid",
    });
    expect(getFoodSourceMeta({ ...foods[0], sourceType: "template" })).toMatchObject({
      label: "估算模板",
      tone: "soft",
    });
    expect(getFoodSourceMeta({ ...foods[0], sourceType: "user" })).toMatchObject({
      label: "手動建檔",
      tone: "soft",
    });
  });
});

describe("business day helpers", () => {
  it("uses 4am as the business-day boundary", () => {
    expect(getBusinessDayKey("2026-05-02T02:30:00+08:00")).toBe("2026-05-01");
    expect(getBusinessDayKey("2026-05-02T04:00:00+08:00")).toBe("2026-05-02");
  });

  it("filters logs into the active business day and summarizes carry-over counts", () => {
    const logs = [
      makeLog(foods[0], "2026-05-02T02:30:00+08:00", "點心"),
      makeLog(foods[1], "2026-05-02T09:00:00+08:00", "早餐"),
      makeLog(foods[2], "2026-05-02T18:00:00+08:00", "晚餐"),
      makeLog(foods[0], "2026-05-01T12:00:00+08:00", "午餐"),
    ];

    const today = filterLogsForBusinessDay(logs, "2026-05-02T10:00:00+08:00");
    expect(today.map((log) => log.createdAt)).toEqual(["2026-05-02T18:00:00+08:00", "2026-05-02T09:00:00+08:00"]);

    expect(summarizeBusinessDay(logs, "2026-05-02T10:00:00+08:00")).toMatchObject({
      businessDayKey: "2026-05-02",
      carryOverCount: 0,
      totalCount: 2,
    });

    expect(summarizeBusinessDay(logs, "2026-05-02T03:00:00+08:00")).toMatchObject({
      businessDayKey: "2026-05-01",
      carryOverCount: 1,
      totalCount: 2,
    });
  });

  it("builds user-facing labels for today and carry-over nights", () => {
    expect(deriveBusinessDayLabel({ businessDayKey: "2026-05-02", nowIso: "2026-05-02T10:00:00+08:00", carryOverCount: 0 })).toBe("今天");
    expect(deriveBusinessDayLabel({ businessDayKey: "2026-05-01", nowIso: "2026-05-02T03:00:00+08:00", carryOverCount: 1 })).toBe("今天（含 1 筆凌晨紀錄）");
    expect(deriveBusinessDayLabel({ businessDayKey: "2026-04-30", nowIso: "2026-05-02T10:00:00+08:00", carryOverCount: 0 })).toBe("04/30");
  });
});

describe("deriveHomeQuickActions", () => {
  it("prefers breakfast and drinks in the morning, with continue-last-meal kept separately", () => {
    const logs = [
      makeLog(foods[0], "2026-05-02T02:10:00+08:00", "點心"),
      makeLog(foods[1], "2026-05-01T19:00:00+08:00", "晚餐"),
    ];

    expect(deriveHomeQuickActions(logs, "2026-05-02T08:30:00+08:00")).toMatchObject({
      primary: { id: "today-breakfast", targetScreen: "breakfast", label: "記今天早餐" },
      secondary: { id: "today-drink", targetScreen: "drink", label: "記今天飲料" },
      continueLog: { id: logs[0].id },
      lateNightCatchUp: null,
    });
  });

  it("switches suggestions by time of day and only surfaces late-night catch-up during the cutoff window", () => {
    const logs = [makeLog(foods[0], "2026-05-02T02:10:00+08:00", "點心")];

    expect(deriveHomeQuickActions([], "2026-05-02T13:00:00+08:00").primary).toMatchObject({ label: "記今天午餐", targetScreen: "search" });
    expect(deriveHomeQuickActions([], "2026-05-02T20:00:00+08:00").primary).toMatchObject({ label: "記今天晚餐", targetScreen: "buffet" });
    expect(deriveHomeQuickActions(logs, "2026-05-02T02:30:00+08:00").lateNightCatchUp).toMatchObject({ label: "補記上一餐", targetScreen: "detail" });
    expect(deriveHomeQuickActions(logs, "2026-05-02T08:30:00+08:00").lateNightCatchUp).toBeNull();
  });
});
