import type { NutritionProfile, NutritionSnapshot } from "./nutrition-service";

export type NutritionUiScreen = "login" | "onboarding" | "home";

function isSameNutritionProfile(left: NutritionProfile, right: NutritionProfile) {
  return left.email === right.email
    && left.goal === right.goal
    && left.calorieTarget === right.calorieTarget
    && left.proteinTarget === right.proteinTarget
    && left.carbTarget === right.carbTarget;
}

export function resolveEditableNutritionProfile({
  profile,
  draft,
}: {
  profile: NutritionProfile | null;
  draft: NutritionProfile;
}): NutritionProfile {
  if (!profile) return draft;
  return isSameNutritionProfile(profile, draft) ? profile : draft;
}

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
