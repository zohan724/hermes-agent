export type HistoryCalendarSummary = {
  businessDayKey: string;
  calories: number;
  totalCount: number;
};

export type HistoryCalendarCell = {
  businessDayKey: string;
  dayNumber: number;
  calories: number;
  totalCount: number;
  isSelected: boolean;
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function shiftMonthKey(monthKey: string, delta: number) {
  const [yearText, monthText] = monthKey.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function buildHistoryCalendar({
  visibleMonthKey,
  summaries,
  selectedBusinessDayKey,
}: {
  visibleMonthKey: string;
  summaries: HistoryCalendarSummary[];
  selectedBusinessDayKey: string | null;
}) {
  const [yearText, monthText] = visibleMonthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const firstDayIndex = new Date(year, month - 1, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const byKey = new Map(summaries.map((summary) => [summary.businessDayKey, summary]));
  const cells: Array<HistoryCalendarCell | null> = [];

  for (let i = 0; i < firstDayIndex; i += 1) cells.push(null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const businessDayKey = `${year}-${pad(month)}-${pad(day)}`;
    const summary = byKey.get(businessDayKey);
    cells.push({
      businessDayKey,
      dayNumber: day,
      calories: summary?.calories ?? 0,
      totalCount: summary?.totalCount ?? 0,
      isSelected: selectedBusinessDayKey === businessDayKey,
    });
  }

  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);

  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));

  return {
    monthLabel: `${year} 年 ${month} 月`,
    weeks,
  };
}
