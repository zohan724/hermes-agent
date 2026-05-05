import { lookupFoodByBarcode, type FoodItem, type MealLog } from "./data";

export type NutritionGoal = "維持" | "減脂" | "增加蛋白質" | "控碳";

export type NutritionProfile = {
  email: string;
  goal: NutritionGoal;
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
};

export type NutritionSnapshot = {
  auth: { authed: boolean; email: string | null };
  profile: NutritionProfile | null;
  logs: MealLog[];
  customFoods: FoodItem[];
  recentSearches: string[];
  foodCatalog: FoodItem[];
  frequentFoods: FoodItem[];
};

export type NutritionRepository = {
  getSnapshot(): NutritionSnapshot;
  setSession(auth: { authed: boolean; email: string | null }): void;
  saveProfile(profile: NutritionProfile | null): void;
  saveCustomFood(food: FoodItem): void;
  recordSearch(keyword: string): void;
  addLog(log: MealLog): void;
  saveLogs(logs: MealLog[]): void;
  hydrate?(): Promise<NutritionSnapshot>;
  flush?(): Promise<void>;
};

export function createNutritionService(repo: NutritionRepository) {
  return {
    getSnapshot: () => repo.getSnapshot(),
    hydrate: () => repo.hydrate?.() ?? Promise.resolve(repo.getSnapshot()),
    flush: () => repo.flush?.() ?? Promise.resolve(),
    findFoodByBarcode(barcode: string) {
      return lookupFoodByBarcode(repo.getSnapshot().foodCatalog, barcode);
    },
    completeLogin(email: string) {
      repo.setSession({ authed: true, email });
      const current = repo.getSnapshot().profile;
      if (current) {
        repo.saveProfile({ ...current, email });
      }
    },
    logout() {
      repo.setSession({ authed: false, email: null });
      repo.saveProfile(null);
    },
    saveProfile(profile: NutritionProfile | null) {
      repo.saveProfile(profile);
    },
    saveCustomFood(food: FoodItem) {
      repo.saveCustomFood(food);
    },
    recordSearch(keyword: string) {
      repo.recordSearch(keyword);
    },
    addLog(log: MealLog) {
      repo.addLog(log);
    },
    saveLogs(logs: MealLog[]) {
      repo.saveLogs(logs);
    },
  };
}
