export type BottomNavActiveTab = "今日" | "records" | "歷史";
export type BottomNavTab = "今天" | "紀錄" | "歷史";
export type BottomNavTargetScreen = "home" | "records" | "history";

export function resolveBottomNavTarget({ tab }: { active: BottomNavActiveTab; tab: BottomNavTab }): BottomNavTargetScreen {
  if (tab === "紀錄") return "records";
  if (tab === "歷史") return "history";
  return "home";
}
