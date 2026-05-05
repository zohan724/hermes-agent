import type { NutritionProfile, NutritionSnapshot } from "./nutrition-service";

export type NutritionUiScreen = "login" | "onboarding" | "home";

export function deriveNutritionUiState({
  snapshot,
  currentDraft,
  fallbackProfile,
}: {
  snapshot: NutritionSnapshot;
  currentDraft: NutritionProfile;
  fallbackProfile: NutritionProfile;
}): { screen: NutritionUiScreen; onboardingDraft: NutritionProfile } {
  const email = snapshot.auth.email ?? "";

  if (!snapshot.auth.authed || !snapshot.auth.email) {
    return {
      screen: "login",
      onboardingDraft: { ...fallbackProfile, email: "" },
    };
  }

  if (snapshot.profile) {
    return {
      screen: "home",
      onboardingDraft: snapshot.profile,
    };
  }

  return {
    screen: "onboarding",
    onboardingDraft: { ...currentDraft, email },
  };
}
