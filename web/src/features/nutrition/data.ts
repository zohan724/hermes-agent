export type MealType = "早餐" | "午餐" | "晚餐" | "點心";

const BUSINESS_DAY_START_HOUR = 4;

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
  tags?: string[];
  barcode?: string;
  sourceType?: "curated" | "barcode" | "user" | "template";
  createdAt?: string;
};

export type FoodSourceMeta = {
  label: string;
  tone: "solid" | "soft";
  hint: string;
};

export type MealLog = {
  id: string;
  mealType: MealType;
  food: FoodItem;
  createdAt: string;
};

export type HomeQuickAction = {
  id: string;
  label: string;
  targetScreen: "breakfast" | "search" | "buffet" | "drink" | "detail";
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
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return [...foods]
    .filter((food) => {
      const fields = [food.name, food.brand ?? "", food.serving, ...(food.aliases ?? []), ...(food.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => fields.includes(token));
    })
    .sort((a, b) => {
      const scoreDelta = scoreFoodMatch(b, normalized) - scoreFoodMatch(a, normalized);
      if (scoreDelta !== 0) return scoreDelta;
      const indexDelta = a.name.toLowerCase().indexOf(tokens[0] ?? normalized) - b.name.toLowerCase().indexOf(tokens[0] ?? normalized);
      if (indexDelta !== 0) return indexDelta;
      return a.name.length - b.name.length || a.name.localeCompare(b.name, "zh-Hant");
    });
}

function scoreFoodMatch(food: FoodItem, query: string): number {
  const tokens = query.split(/\s+/).filter(Boolean);
  const name = food.name.toLowerCase();
  const brand = (food.brand ?? "").toLowerCase();
  const aliases = (food.aliases ?? []).map((alias) => alias.toLowerCase());
  const tags = (food.tags ?? []).map((tag) => tag.toLowerCase());
  if (name === query) return 300;
  if (aliases.includes(query)) return 260;
  if (tags.includes(query)) return 220;
  if (name.startsWith(query)) return 200;
  if (aliases.some((alias) => alias.startsWith(query))) return 170;
  if (tags.some((tag) => tag.startsWith(query))) return 150;
  if (name.includes(query)) return 120;
  if (aliases.some((alias) => alias.includes(query))) return 100;
  if (brand.includes(query)) return 80;
  if (tags.some((tag) => tag.includes(query))) return 70;
  return (
    tokens.reduce((score, token) => {
      if (name.startsWith(token)) return score + 40;
      if (aliases.some((alias) => alias.startsWith(token))) return score + 36;
      if (tags.includes(token)) return score + 32;
      if (brand.includes(token)) return score + 24;
      if (name.includes(token)) return score + 18;
      if (aliases.some((alias) => alias.includes(token))) return score + 14;
      if (tags.some((tag) => tag.includes(token))) return score + 12;
      return score;
    }, 0) || 10
  );
}

export function lookupFoodByBarcode(foods: FoodItem[], barcode: string): FoodItem | undefined {
  return foods.find((food) => food.barcode === barcode);
}

export function getBusinessDayKey(iso: string, dayStartHour = BUSINESS_DAY_START_HOUR): string {
  const local = deriveLocalParts(iso);
  const shifted = shiftBusinessDay(local, dayStartHour);
  return `${shifted.year}-${pad2(shifted.month)}-${pad2(shifted.day)}`;
}

export function filterLogsForBusinessDay(logs: MealLog[], nowIso: string, dayStartHour = BUSINESS_DAY_START_HOUR): MealLog[] {
  const businessDayKey = getBusinessDayKey(nowIso, dayStartHour);
  return [...logs]
    .filter((log) => getBusinessDayKey(log.createdAt, dayStartHour) === businessDayKey)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function summarizeBusinessDay(logs: MealLog[], nowIso: string, dayStartHour = BUSINESS_DAY_START_HOUR) {
  const businessDayKey = getBusinessDayKey(nowIso, dayStartHour);
  const filteredLogs = filterLogsForBusinessDay(logs, nowIso, dayStartHour);
  const carryOverCount = filteredLogs.filter((log) => deriveLocalParts(log.createdAt).hours < dayStartHour).length;
  return {
    businessDayKey,
    filteredLogs,
    carryOverCount,
    totalCount: filteredLogs.length,
  };
}

export function deriveBusinessDayLabel({
  businessDayKey,
  nowIso,
  carryOverCount,
}: {
  businessDayKey: string;
  nowIso: string;
  carryOverCount: number;
}): string {
  const todayKey = getBusinessDayKey(nowIso);
  if (businessDayKey === todayKey) {
    return carryOverCount > 0 ? `今天（含 ${carryOverCount} 筆凌晨紀錄）` : "今天";
  }
  return `${businessDayKey.slice(5, 7)}/${businessDayKey.slice(8, 10)}`;
}

export function deriveHomeQuickActions(logs: MealLog[], nowIso: string): {
  primary: HomeQuickAction;
  secondary: HomeQuickAction | null;
  continueLog: MealLog | null;
  lateNightCatchUp: HomeQuickAction | null;
} {
  const local = deriveLocalParts(nowIso);
  const latestLog = [...logs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] ?? null;
  const lateNightCatchUp = local.hours < BUSINESS_DAY_START_HOUR && latestLog
    ? { id: "late-night-catch-up", label: "補記上一餐", targetScreen: "detail" as const }
    : null;

  if (local.hours < 11) {
    return {
      primary: { id: "today-breakfast", label: "記今天早餐", targetScreen: "breakfast" },
      secondary: { id: "today-drink", label: "記今天飲料", targetScreen: "drink" },
      continueLog: latestLog,
      lateNightCatchUp,
    };
  }

  if (local.hours < 17) {
    return {
      primary: { id: "today-lunch", label: "記今天午餐", targetScreen: "search" },
      secondary: { id: "today-drink", label: "順手記飲料", targetScreen: "drink" },
      continueLog: latestLog,
      lateNightCatchUp,
    };
  }

  return {
    primary: { id: "today-dinner", label: "記今天晚餐", targetScreen: "buffet" },
    secondary: { id: "today-drink", label: "晚點補飲料", targetScreen: "drink" },
    continueLog: latestLog,
    lateNightCatchUp,
  };
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

export function deriveRecentFoods(logs: MealLog[], limit = 6): FoodItem[] {
  const deduped = new Map<string, FoodItem>();
  for (const log of [...logs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))) {
    if (!deduped.has(log.food.id)) {
      deduped.set(log.food.id, log.food);
    }
    if (deduped.size >= limit) break;
  }
  return [...deduped.values()];
}

export function getFoodSourceMeta(food: FoodItem): FoodSourceMeta {
  switch (food.sourceType) {
    case "barcode":
      return { label: "條碼資料庫", tone: "solid", hint: "包裝品為主，通常最穩" };
    case "curated":
      return { label: "常見食物庫", tone: "solid", hint: "整理過的常見品項" };
    case "template":
      return { label: "估算模板", tone: "soft", hint: "外食變數大，建議再微調份量" };
    case "user":
      return { label: "手動建檔", tone: "soft", hint: "你自己建立的品項" };
    default:
      return { label: "一般資料", tone: "soft", hint: "可再確認份量" };
  }
}

function deriveLocalParts(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hours: Number(match[4]),
      minutes: Number(match[5]),
    };
  }

  const date = new Date(iso);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
  };
}

function shiftBusinessDay(
  local: { year: number; month: number; day: number; hours: number; minutes: number },
  dayStartHour: number,
) {
  if (local.hours >= dayStartHour) return local;
  const shifted = new Date(local.year, local.month - 1, local.day);
  shifted.setDate(shifted.getDate() - 1);
  return {
    year: shifted.getFullYear(),
    month: shifted.getMonth() + 1,
    day: shifted.getDate(),
    hours: local.hours,
    minutes: local.minutes,
  };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}
