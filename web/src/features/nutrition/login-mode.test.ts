import { describe, expect, it } from "vitest";
import { getNutritionLoginMode } from "./login-mode";

describe("getNutritionLoginMode", () => {
  it("prefers Google as the primary entry in production and hides the email test entry", () => {
    expect(getNutritionLoginMode(true, false)).toEqual({
      primaryCta: "google",
      showEmailFields: false,
      emailLabel: "Email（測試入口）",
      emailButtonLabel: "用 Email 繼續（測試）",
      helperText: null,
    });
  });

  it("keeps the email test entry available in dev when Google auth is enabled", () => {
    expect(getNutritionLoginMode(true, true)).toEqual({
      primaryCta: "google",
      showEmailFields: true,
      emailLabel: "Email（測試入口）",
      emailButtonLabel: "用 Email 繼續（測試）",
      helperText: "正式登入走 Google；Email 先保留給測試。",
    });
  });

  it("falls back to email-first login when Google auth is unavailable", () => {
    expect(getNutritionLoginMode(false, false)).toEqual({
      primaryCta: "email",
      showEmailFields: true,
      emailLabel: "Email",
      emailButtonLabel: "Email 登入",
      helperText: null,
    });
  });
});
