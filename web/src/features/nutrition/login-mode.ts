export type NutritionLoginMode = {
  primaryCta: "google" | "email";
  showEmailFields: boolean;
  emailLabel: string;
  emailButtonLabel: string;
  helperText: string | null;
};

export function getNutritionLoginMode(googleEnabled: boolean, allowEmailTestEntry: boolean): NutritionLoginMode {
  if (googleEnabled) {
    return {
      primaryCta: "google",
      showEmailFields: allowEmailTestEntry,
      emailLabel: "Email（測試入口）",
      emailButtonLabel: "用 Email 繼續（測試）",
      helperText: allowEmailTestEntry ? "正式登入走 Google；Email 先保留給測試。" : null,
    };
  }

  return {
    primaryCta: "email",
    showEmailFields: true,
    emailLabel: "Email",
    emailButtonLabel: "Email 登入",
    helperText: null,
  };
}
