import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/pages/NutritionMvpPage";

describe("BottomNav", () => {
  it("does not render a standalone 紀錄 tab", () => {
    const html = renderToStaticMarkup(
      <BottomNav
        active="今日"
        onAddRecord={vi.fn()}
        onHistory={vi.fn()}
      />,
    );

    expect(html).not.toContain('aria-label="查看今日紀錄"');
    expect(html).not.toContain("紀錄</button>");
    expect(html).not.toContain(">我的<");
    expect(html).toContain(">歷史<");
    expect(html).toContain(">今日<");
  });
});
