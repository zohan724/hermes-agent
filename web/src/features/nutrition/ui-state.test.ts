import { describe, expect, it } from "vitest";
import { deriveNutritionUiState } from "./ui-state";
import type { NutritionProfile, NutritionSnapshot } from "./nutrition-service";

const defaultProfile: NutritionProfile = {
  email: "",
  goal: "維持",
  calorieTarget: 1800,
  proteinTarget: 110,
  carbTarget: 220,
};

const savedProfile: NutritionProfile = {
  email: "zohan@example.com",
  goal: "減脂",
  calorieTarget: 1999,
  proteinTarget: 140,
  carbTarget: 150,
};

function makeSnapshot(partial: Partial<NutritionSnapshot>): NutritionSnapshot {
  return {
    auth: { authed: false, email: null },
    profile: null,
    logs: [],
    customFoods: [],
    recentSearches: [],
    foodCatalog: [],
    frequentFoods: [],
    ...partial,
  };
}

describe("deriveNutritionUiState", () => {
  it("returns home and the hydrated profile after relogin when remote profile exists", () => {
    const state = deriveNutritionUiState({
      snapshot: makeSnapshot({
        auth: { authed: true, email: "zohan@example.com" },
        profile: savedProfile,
      }),
      currentDraft: defaultProfile,
      fallbackProfile: defaultProfile,
    });

    expect(state.screen).toBe("home");
    expect(state.onboardingDraft).toEqual(savedProfile);
  });

  it("keeps onboarding when signed in but still has no saved profile", () => {
    const state = deriveNutritionUiState({
      snapshot: makeSnapshot({
        auth: { authed: true, email: "zohan@example.com" },
        profile: null,
      }),
      currentDraft: defaultProfile,
      fallbackProfile: defaultProfile,
    });

    expect(state.screen).toBe("onboarding");
    expect(state.onboardingDraft).toEqual({ ...defaultProfile, email: "zohan@example.com" });
  });
});
