import { describe, expect, it } from "vitest";
import { getNutritionLoginMode } from "./login-mode";

describe("getNutritionLoginMode", () => {
  it("prefers Google as the primary entry when Supabase auth is enabled", () => {
    expect(getNutritionLoginMode(true)).toEqual({
      primaryCta: "google",
      showEmailFields: true,
      emailLabel: "Email（測試入口）",
      emailButtonLabel: "用 Email 繼續（測試）",
      helperText: "正式登入走 Google；Email 先保留給測試。",
    });
  });

  it("falls back to email-first login when Google auth is unavailable", () => {
    expect(getNutritionLoginMode(false)).toEqual({
      primaryCta: "email",
      showEmailFields: true,
      emailLabel: "Email",
      emailButtonLabel: "Email 登入",
      helperText: null,
    });
  });
});
