import { describe, expect, it } from "vitest";
import { getNutritionPageLayout } from "./page-layout";

describe("getNutritionPageLayout", () => {
  it("returns a web-first responsive layout instead of a fake phone shell", () => {
    expect(getNutritionPageLayout()).toEqual({
      viewportClass:
        "min-h-dvh bg-[radial-gradient(circle_at_top,#f3fbf5_0%,#eef6f0_38%,#e6efe8_100%)] px-3 py-4 sm:px-5 sm:py-6 lg:px-8",
      shellClass: "mx-auto w-full max-w-6xl",
      contentClass: "px-0 py-0 sm:px-0 sm:py-0",
      showStatusBar: false,
    });
  });
});
