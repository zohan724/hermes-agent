import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/pages/NutritionMvpPage";

describe("BottomNav", () => {
  it("renders the 紀錄 tab as a real button when a handler is provided", () => {
    const html = renderToStaticMarkup(
      <BottomNav
        active="今日"
        onRecord={vi.fn()}
        onAddRecord={vi.fn()}
        onHistory={vi.fn()}
        onSettings={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="查看今日紀錄"');
    expect(html).toMatch(/<button[^>]*aria-label="查看今日紀錄"[^>]*>.*紀錄.*<\/button>/s);
  });
});
