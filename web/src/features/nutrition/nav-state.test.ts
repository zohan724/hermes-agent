import { describe, expect, it } from "vitest";
import { resolveBottomNavTarget } from "./nav-state";

describe("resolveBottomNavTarget", () => {
  it("routes record tab to a dedicated records screen instead of a home anchor", () => {
    expect(resolveBottomNavTarget({ active: "今日", tab: "紀錄" })).toBe("records");
    expect(resolveBottomNavTarget({ active: "歷史", tab: "紀錄" })).toBe("records");
  });

  it("keeps today and history tabs switching whole screens", () => {
    expect(resolveBottomNavTarget({ active: "records", tab: "今天" })).toBe("home");
    expect(resolveBottomNavTarget({ active: "records", tab: "歷史" })).toBe("history");
  });
});
