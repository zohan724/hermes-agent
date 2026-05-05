export type MealType = "早餐" | "午餐" | "晚餐" | "點心";

export type FoodItem = {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  serving: string;
  category: "packaged" | "meal" | "drink" | "fruit";
  aliases?: string[];
  barcode?: string;
  sourceType?: "curated" | "barcode" | "user" | "template";
  createdAt?: string;
};

export type MealLog = {
  id: string;
  mealType: MealType;
  food: FoodItem;
  createdAt: string;
};

export function recordRecentSearch(current: string[], keyword: string, limit = 6): string[] {
  const trimmed = keyword.trim();
  if (!trimmed) return current;
  return [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, limit);
}

export function buildFoodCatalog(baseFoods: FoodItem[], customFoods: FoodItem[]): FoodItem[] {
  const deduped = new Map<string, FoodItem>();
  for (const food of [...customFoods, ...baseFoods]) {
    if (!deduped.has(food.id)) deduped.set(food.id, food);
  }
  return [...deduped.values()].sort((a, b) => {
    const aTime = a.createdAt ? +new Date(a.createdAt) : 0;
    const bTime = b.createdAt ? +new Date(b.createdAt) : 0;
    return bTime - aTime || a.name.localeCompare(b.name, "zh-Hant");
  });
}

export function searchFoods(foods: FoodItem[], query: string): FoodItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return foods;
  return [...foods]
    .filter((food) => {
      const haystack = [food.name, food.brand ?? "", food.serving, ...(food.aliases ?? [])].join(" ").toLowerCase();
      return haystack.includes(normalized);
    })
    .sort((a, b) => {
      const scoreDelta = scoreFoodMatch(b, normalized) - scoreFoodMatch(a, normalized);
      if (scoreDelta !== 0) return scoreDelta;
      const indexDelta = a.name.toLowerCase().indexOf(normalized) - b.name.toLowerCase().indexOf(normalized);
      if (indexDelta !== 0) return indexDelta;
      return a.name.length - b.name.length || a.name.localeCompare(b.name, "zh-Hant");
    });
}

function scoreFoodMatch(food: FoodItem, query: string): number {
  const name = food.name.toLowerCase();
  const brand = (food.brand ?? "").toLowerCase();
  const aliases = (food.aliases ?? []).map((alias) => alias.toLowerCase());
  if (name === query) return 300;
  if (aliases.includes(query)) return 260;
  if (name.startsWith(query)) return 200;
  if (aliases.some((alias) => alias.startsWith(query))) return 170;
  if (name.includes(query)) return 120;
  if (aliases.some((alias) => alias.includes(query))) return 100;
  if (brand.includes(query)) return 80;
  return 10;
}

export function lookupFoodByBarcode(foods: FoodItem[], barcode: string): FoodItem | undefined {
  return foods.find((food) => food.barcode === barcode);
}

export function deriveFrequentFoods(logs: MealLog[], limit = 4): FoodItem[] {
  const map = new Map<string, { food: FoodItem; count: number; createdAt: string }>();
  for (const log of logs) {
    const existing = map.get(log.food.id);
    if (existing) {
      existing.count += 1;
      if (+new Date(log.createdAt) > +new Date(existing.createdAt)) {
        existing.createdAt = log.createdAt;
        existing.food = log.food;
      }
    } else {
      map.set(log.food.id, { food: log.food, count: 1, createdAt: log.createdAt });
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, limit)
    .map((entry) => entry.food);
}
