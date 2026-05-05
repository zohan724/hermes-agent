export {
  createLocalNutritionRepo as createNutritionRepo,
  createMemoryStorage,
  defaultNutritionSeed,
  getBrowserStorage,
  type NutritionSeed,
  type StorageLike,
} from "./local-nutrition-repo";

export {
  createRemoteNutritionRepo,
} from "./remote-nutrition-repo";

export {
  createNutritionRepository,
  getPreferredNutritionRepoMode,
  type NutritionRepoMode,
} from "./repo-factory";

export {
  createNutritionService,
  type NutritionGoal,
  type NutritionProfile,
  type NutritionRepository,
  type NutritionSnapshot,
} from "./nutrition-service";
