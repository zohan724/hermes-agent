import { describe, expect, it } from "vitest";
import { buildHistoryCalendar, shiftMonthKey } from "./history-calendar";

describe("buildHistoryCalendar", () => {
  it("builds a sunday-first month grid with summary values mapped onto matching days", () => {
    const calendar = buildHistoryCalendar({
      visibleMonthKey: "2026-05",
      summaries: [
        { businessDayKey: "2026-05-01", calories: 540, totalCount: 2 },
        { businessDayKey: "2026-05-12", calories: 1220, totalCount: 4 },
      ],
      selectedBusinessDayKey: "2026-05-12",
    });

    expect(calendar.monthLabel).toBe("2026 年 5 月");
    expect(calendar.weeks).toHaveLength(6);
    expect(calendar.weeks[0].slice(0, 5).map((cell) => cell?.dayNumber ?? null)).toEqual([null, null, null, null, null]);
    expect(calendar.weeks[0][5]).toMatchObject({ businessDayKey: "2026-05-01", dayNumber: 1, calories: 540, totalCount: 2 });
    expect(calendar.weeks[2][2]).toMatchObject({ businessDayKey: "2026-05-12", dayNumber: 12, isSelected: true, calories: 1220, totalCount: 4 });
  });

  it("pads to a full 6-row grid and marks empty days with zero totals", () => {
    const calendar = buildHistoryCalendar({
      visibleMonthKey: "2026-08",
      summaries: [],
      selectedBusinessDayKey: null,
    });

    expect(calendar.weeks).toHaveLength(6);
    expect(calendar.weeks[0][6]).toMatchObject({ businessDayKey: "2026-08-01", dayNumber: 1, calories: 0, totalCount: 0 });
    expect(calendar.weeks[5][1]).toMatchObject({ businessDayKey: "2026-08-31", dayNumber: 31, calories: 0, totalCount: 0 });
  });
});

describe("shiftMonthKey", () => {
  it("moves forward and backward across year boundaries", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
  });
});
