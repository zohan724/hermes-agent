import { describe, expect, it, vi } from "vitest";
import { syncNutritionSessionFromEmail } from "./session-sync";

describe("syncNutritionSessionFromEmail", () => {
  it("logs the nutrition service in when Supabase returns an email", () => {
    const completeLogin = vi.fn();
    const logout = vi.fn();

    syncNutritionSessionFromEmail({ completeLogin, logout }, "zohan@example.com");

    expect(completeLogin).toHaveBeenCalledWith("zohan@example.com");
    expect(logout).not.toHaveBeenCalled();
  });

  it("logs the nutrition service out when Supabase has no email", () => {
    const completeLogin = vi.fn();
    const logout = vi.fn();

    syncNutritionSessionFromEmail({ completeLogin, logout }, null);

    expect(logout).toHaveBeenCalled();
    expect(completeLogin).not.toHaveBeenCalled();
  });
});