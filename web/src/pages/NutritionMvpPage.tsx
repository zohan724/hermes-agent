import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Barcode,
  Bell,
  Camera,
  ChartColumn,
  ChevronRight,
  CircleHelp,
  House,
  Image as ImageIcon,
  Leaf,
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  Star,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  searchFoods,
  type FoodItem,
  type MealLog,
  type MealType,
} from "@/features/nutrition/data";
import {
  defaultNutritionSeed,
} from "@/features/nutrition/local-nutrition-repo";
import {
  createNutritionService,
  type NutritionProfile,
} from "@/features/nutrition/nutrition-service";
import {
  createNutritionRepository,
  getPreferredNutritionRepoMode,
} from "@/features/nutrition/repo-factory";
import {
  createSupabaseBrowserClient,
  createSupabaseGoogleAuth,
  isSupabaseAuthConfigured,
} from "@/features/nutrition/supabase-auth";
import { syncNutritionSessionFromEmail } from "@/features/nutrition/session-sync";
import { getNutritionLoginMode } from "@/features/nutrition/login-mode";
import { getNutritionPageLayout } from "@/features/nutrition/page-layout";
import { deriveNutritionUiState, resolveEditableNutritionProfile } from "@/features/nutrition/ui-state";

type Screen = "login" | "onboarding" | "home" | "scan" | "ocr" | "lunchbox" | "search" | "buffet" | "camera" | "cook" | "selector" | "detail" | "history" | "favorites" | "settings";

type OcrDraft = {
  name: string;
  brand: string;
  serving: string;
  calories: string;
  protein: string;
  carbs: string;
};

type DetailDraft = {
  food: FoodItem;
  mealType: MealType;
  quantity: number;
  editingLogId?: string;
};

type UserProfile = NutritionProfile;

const DAILY_TARGET = {
  calories: 1800,
  protein: 110,
  carbs: 220,
} as const;

const quickActions = [
  { key: "scan", label: "掃條碼", icon: Barcode },
  { key: "search", label: "搜尋食物", icon: Search },
  { key: "ocr", label: "拍營養標示", icon: NotebookPen },
  { key: "camera", label: "拍照辨識", icon: Camera },
  { key: "lunchbox", label: "健康餐盒", icon: UtensilsCrossed },
  { key: "buffet", label: "自助餐", icon: Sparkles },
  { key: "cook", label: "自己煮", icon: Leaf },
  { key: "favorite", label: "常吃", icon: Star },
] as const;

type LunchboxState = {
  protein: string;
  starch: string;
  vegetables: string[];
  sauces: string[];
  extras: string[];
};

type BuffetState = {
  staple: string;
  protein: string[];
  vegetables: string[];
  extras: string[];
};

type CameraState = {
  items: Array<{ id: string; label: string; calories: number; protein: number; carbs: number }>;
};

type SelfCookState = {
  selected: string[];
};

const lunchboxProteinOptions = [
  { id: "chicken", label: "舒肥雞胸", calories: 180, protein: 30, carbs: 0 },
  { id: "leg", label: "烤雞腿", calories: 220, protein: 24, carbs: 0 },
  { id: "fish", label: "烤鯖魚", calories: 210, protein: 22, carbs: 0 },
  { id: "beef", label: "牛肉片", calories: 250, protein: 23, carbs: 2 },
  { id: "tofu", label: "豆腐 / 豆包", calories: 160, protein: 14, carbs: 6 },
] as const;

const lunchboxStarchOptions = [
  { id: "rice", label: "白飯", calories: 240, protein: 4, carbs: 53 },
  { id: "multigrain", label: "五穀飯", calories: 220, protein: 4, carbs: 46 },
  { id: "sweet-potato", label: "地瓜", calories: 180, protein: 3, carbs: 41 },
  { id: "brown-rice", label: "糙米飯", calories: 210, protein: 4, carbs: 44 },
  { id: "quinoa", label: "藜麥飯", calories: 205, protein: 6, carbs: 38 },
] as const;

const lunchboxVegetableOptions = [
  { id: "broccoli", label: "花椰菜", calories: 35, protein: 3, carbs: 7 },
  { id: "cabbage", label: "高麗菜", calories: 28, protein: 2, carbs: 5 },
  { id: "amaranth", label: "莧菜", calories: 32, protein: 2, carbs: 4 },
  { id: "sprout", label: "豆芽菜", calories: 25, protein: 2, carbs: 3 },
  { id: "pepper", label: "彩椒", calories: 30, protein: 1, carbs: 6 },
] as const;

const lunchboxSauceOptions = [
  { id: "wafu", label: "和風醬", calories: 45, protein: 0, carbs: 5 },
  { id: "sesame", label: "胡麻醬", calories: 80, protein: 1, carbs: 3 },
  { id: "vinaigrette", label: "油醋醬", calories: 50, protein: 0, carbs: 2 },
  { id: "chili", label: "辣椒醬", calories: 20, protein: 0, carbs: 2 },
] as const;

const lunchboxExtraOptions = [
  { id: "egg", label: "加蛋", calories: 70, protein: 6, carbs: 1 },
  { id: "veg-up", label: "加青菜", calories: 20, protein: 1, carbs: 3 },
] as const;

const defaultLunchbox: LunchboxState = {
  protein: "chicken",
  starch: "rice",
  vegetables: ["broccoli", "amaranth", "pepper"],
  sauces: ["sesame"],
  extras: ["egg"],
};

const buffetStapleOptions = [
  { id: "white-rice", label: "白飯", calories: 220, protein: 4, carbs: 48 },
  { id: "multigrain-rice", label: "五穀飯", calories: 205, protein: 4, carbs: 43 },
  { id: "no-rice", label: "不加主食", calories: 0, protein: 0, carbs: 0 },
] as const;

const buffetProteinOptions = [
  { id: "braised-chicken", label: "滷雞腿", calories: 180, protein: 20, carbs: 3 },
  { id: "fried-fish", label: "煎魚", calories: 150, protein: 18, carbs: 0 },
  { id: "egg", label: "滷蛋", calories: 70, protein: 6, carbs: 1 },
  { id: "tofu", label: "豆腐", calories: 90, protein: 8, carbs: 3 },
] as const;

const buffetVegetableOptions = [
  { id: "cabbage", label: "高麗菜", calories: 28, protein: 2, carbs: 5 },
  { id: "broccoli", label: "花椰菜", calories: 35, protein: 3, carbs: 7 },
  { id: "spinach", label: "菠菜", calories: 26, protein: 2, carbs: 4 },
  { id: "beansprout", label: "豆芽菜", calories: 24, protein: 2, carbs: 3 },
] as const;

const buffetExtraOptions = [
  { id: "fried-item", label: "炸物", calories: 120, protein: 3, carbs: 10 },
  { id: "braised-sauce", label: "滷汁偏多", calories: 45, protein: 0, carbs: 4 },
] as const;

const defaultBuffet: BuffetState = {
  staple: "white-rice",
  protein: ["braised-chicken"],
  vegetables: ["cabbage", "broccoli"],
  extras: [],
};

const defaultCamera: CameraState = {
  items: [
    { id: 'rice', label: '白飯', calories: 220, protein: 4, carbs: 48 },
    { id: 'chicken', label: '雞胸', calories: 165, protein: 29, carbs: 0 },
    { id: 'veg', label: '青菜', calories: 35, protein: 2, carbs: 6 },
  ],
};

const selfCookOptions = [
  { id: 'egg', label: '雞蛋', calories: 70, protein: 6, carbs: 1 },
  { id: 'chicken', label: '雞胸', calories: 120, protein: 24, carbs: 0 },
  { id: 'tofu', label: '豆腐', calories: 90, protein: 8, carbs: 3 },
  { id: 'broccoli', label: '花椰菜', calories: 35, protein: 3, carbs: 7 },
  { id: 'rice', label: '白飯', calories: 220, protein: 4, carbs: 48 },
  { id: 'sweet-potato', label: '地瓜', calories: 180, protein: 3, carbs: 41 },
  { id: 'soy-milk', label: '無糖豆漿', calories: 80, protein: 7, carbs: 8 },
] as const;

const defaultSelfCook: SelfCookState = {
  selected: ['egg', 'chicken', 'broccoli'],
};

const defaultProfile: UserProfile = {
  email: "",
  goal: "維持",
  calorieTarget: DAILY_TARGET.calories,
  proteinTarget: DAILY_TARGET.protein,
  carbTarget: DAILY_TARGET.carbs,
};

function percent(value: number, total: number) {
  return Math.min(100, Math.round((value / total) * 100));
}

function barStyle(value: number, total: number, color: string) {
  return { width: `${percent(value, total)}%`, backgroundColor: color };
}

function makeLog(food: FoodItem, mealType: MealType, createdAt = new Date().toISOString()): MealLog {
  return {
    id: `${food.id}-${createdAt}`,
    mealType,
    food,
    createdAt,
  };
}

function scaleFood(food: FoodItem, quantity: number): FoodItem {
  const ratio = Math.max(quantity, 0.25);
  return {
    ...food,
    calories: Math.round(food.calories * ratio),
    protein: Math.round(food.protein * ratio * 10) / 10,
    carbs: Math.round(food.carbs * ratio * 10) / 10,
    serving: quantity === 1 ? food.serving : `${quantity} 份｜${food.serving}`,
  };
}

function byRecency<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function FoodEmoji({ category }: { category: FoodItem["category"] }) {
  const emoji =
    category === "drink" ? "🥛" : category === "fruit" ? "🍌" : category === "meal" ? "🍱" : "🥪";
  return <span className="text-xl leading-none">{emoji}</span>;
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-[1rem] font-semibold tracking-[-0.01em] text-[#1F1F1C]">{title}</h3>
      {action ? (
        <button onClick={onAction} className="flex items-center gap-1 text-sm font-medium text-[#2F80ED]">
          {action}
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export default function NutritionMvpPage() {
  const pageLayout = getNutritionPageLayout();
  const repo = useMemo(
    () =>
      createNutritionRepository({
        mode: getPreferredNutritionRepoMode(import.meta.env),
        seed: defaultNutritionSeed,
      }),
    [],
  );
  const service = useMemo(() => createNutritionService(repo), [repo]);
  const supabaseAuth = useMemo(() => {
    if (!isSupabaseAuthConfigured(import.meta.env as Record<string, string | undefined>)) return null;
    const client = createSupabaseBrowserClient(import.meta.env as Record<string, string | undefined>);
    return client ? createSupabaseGoogleAuth(client) : null;
  }, []);
  const [snapshot, setSnapshot] = useState(() => service.getSnapshot());
  const { auth, profile, logs, recentSearches, foodCatalog, frequentFoods } = snapshot;
  const authed = auth.authed;
  const [loginDraft, setLoginDraft] = useState({ email: "zohan@example.com", password: "123456" });
  const [onboardingDraft, setOnboardingDraft] = useState<UserProfile>(() => profile ?? defaultProfile);
  const [screen, setScreen] = useState<Screen>(() => {
    if (!authed) return "login";
    if (!profile) return "onboarding";
    return "home";
  });
  const [scanState, setScanState] = useState<"idle" | "found" | "not-found">("idle");
  const [scannedFood, setScannedFood] = useState<FoodItem | null>(null);
  const [detailDraft, setDetailDraft] = useState<DetailDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [buffet, setBuffet] = useState<BuffetState>(defaultBuffet);
  const [cameraState, setCameraState] = useState<CameraState>(defaultCamera);
  const [selfCook, setSelfCook] = useState<SelfCookState>(defaultSelfCook);
  const [lunchbox, setLunchbox] = useState<LunchboxState>(defaultLunchbox);
  const [ocrDraft, setOcrDraft] = useState<OcrDraft>({
    name: "全聯高蛋白豆奶",
    brand: "PX Mart",
    serving: "每瓶 375ml",
    calories: "168",
    protein: "18",
    carbs: "14",
  });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshSnapshot = () => setSnapshot(service.getSnapshot());

  const applySessionEmail = (email: string | null) => {
    syncNutritionSessionFromEmail(service, email);
    const nextSnapshot = service.getSnapshot();
    const nextUiState = deriveNutritionUiState({
      snapshot: nextSnapshot,
      currentDraft: onboardingDraft,
      fallbackProfile: defaultProfile,
    });
    setSnapshot(nextSnapshot);
    if (email) {
      setLoginDraft((current) => ({ ...current, email }));
    }
    setOnboardingDraft(nextUiState.onboardingDraft);
    setScreen(nextUiState.screen);
  };

  useEffect(() => {
    let cancelled = false;
    service
      .hydrate()
      .then((nextSnapshot) => {
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setOnboardingDraft((current) =>
          deriveNutritionUiState({
            snapshot: nextSnapshot,
            currentDraft: current,
            fallbackProfile: defaultProfile,
          }).onboardingDraft,
        );
        setScreen((current) => {
          const nextUiState = deriveNutritionUiState({
            snapshot: nextSnapshot,
            currentDraft: onboardingDraft,
            fallbackProfile: defaultProfile,
          });
          return current === "detail" || current === "search" || current === "settings" || current === "history"
            ? current
            : nextUiState.screen;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [service, auth.authed, auth.email]);

  useEffect(() => {
    if (!supabaseAuth) return;

    let cancelled = false;
    supabaseAuth
      .getSessionEmail()
      .then((email) => {
        if (!cancelled) applySessionEmail(email);
      })
      .catch((error) => {
        if (!cancelled) setAuthError(error instanceof Error ? error.message : "Google 登入初始化失敗");
      });

    const subscription = supabaseAuth.onAuthStateChange((email) => {
      if (!cancelled) applySessionEmail(email);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabaseAuth]);

  const totals = useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        acc.calories += log.food.calories;
        acc.protein += log.food.protein;
        acc.carbs += log.food.carbs;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0 },
    );
  }, [logs]);

  const activeTarget = {
    calories: profile?.calorieTarget ?? DAILY_TARGET.calories,
    protein: profile?.proteinTarget ?? DAILY_TARGET.protein,
    carbs: profile?.carbTarget ?? DAILY_TARGET.carbs,
  };

  const breakfastTotal = useMemo(
    () => logs.filter((log) => log.mealType === "早餐").reduce((sum, log) => sum + log.food.calories, 0),
    [logs],
  );

  const todayLogs = useMemo(() => byRecency(logs), [logs]);

  const lunchboxEstimate = useMemo(() => {
    const selectedProtein = lunchboxProteinOptions.find((item) => item.id === lunchbox.protein)!;
    const selectedStarch = lunchboxStarchOptions.find((item) => item.id === lunchbox.starch)!;
    const selectedVegetables = lunchboxVegetableOptions.filter((item) => lunchbox.vegetables.includes(item.id));
    const selectedSauces = lunchboxSauceOptions.filter((item) => lunchbox.sauces.includes(item.id));
    const selectedExtras = lunchboxExtraOptions.filter((item) => lunchbox.extras.includes(item.id));
    const all = [selectedProtein, selectedStarch, ...selectedVegetables, ...selectedSauces, ...selectedExtras];
    return all.reduce(
      (acc, item) => {
        acc.calories += item.calories;
        acc.protein += item.protein;
        acc.carbs += item.carbs;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0 },
    );
  }, [lunchbox]);

  const buffetEstimate = useMemo(() => {
    const staple = buffetStapleOptions.find((item) => item.id === buffet.staple)!;
    const proteins = buffetProteinOptions.filter((item) => buffet.protein.includes(item.id));
    const vegetables = buffetVegetableOptions.filter((item) => buffet.vegetables.includes(item.id));
    const extras = buffetExtraOptions.filter((item) => buffet.extras.includes(item.id));
    const all = [staple, ...proteins, ...vegetables, ...extras];
    return all.reduce(
      (acc, item) => {
        acc.calories += item.calories;
        acc.protein += item.protein;
        acc.carbs += item.carbs;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0 },
    );
  }, [buffet]);

  const searchableFoods = useMemo(() => searchFoods(foodCatalog, searchQuery), [foodCatalog, searchQuery]);

  const cameraEstimate = useMemo(
    () =>
      cameraState.items.reduce(
        (acc, item) => {
          acc.calories += item.calories;
          acc.protein += item.protein;
          acc.carbs += item.carbs;
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0 },
      ),
    [cameraState],
  );

  const selfCookEstimate = useMemo(() => {
    const selected = selfCookOptions.filter((item) => selfCook.selected.includes(item.id));
    return selected.reduce(
      (acc, item) => {
        acc.calories += item.calories;
        acc.protein += item.protein;
        acc.carbs += item.carbs;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0 },
    );
  }, [selfCook]);

  const addLog = (food: FoodItem, mealType: MealType = "點心") => {
    service.addLog(makeLog(food, mealType));
    refreshSnapshot();
    setScreen("home");
  };

  const rememberSearch = (keyword: string) => {
    service.recordSearch(keyword);
    refreshSnapshot();
  };

  const openSearchKeyword = (keyword: string) => {
    setSearchQuery(keyword);
    rememberSearch(keyword);
  };

  const openDetail = (food: FoodItem, mealType: MealType = "點心", editingLogId?: string) => {
    setDetailDraft({ food, mealType, quantity: 1, editingLogId });
    setScreen("detail");
  };

  const selectSearchFood = (food: FoodItem) => {
    rememberSearch(searchQuery || food.name);
    openDetail(food, food.name.includes("飯糰") ? "早餐" : "點心");
  };

  const saveDetail = () => {
    if (!detailDraft) return;
    const finalFood = scaleFood(detailDraft.food, detailDraft.quantity);
    if (detailDraft.editingLogId) {
      service.saveLogs(
        logs.map((log) =>
          log.id === detailDraft.editingLogId
            ? { ...log, mealType: detailDraft.mealType, food: finalFood }
            : log,
        ),
      );
      refreshSnapshot();
      setScreen("home");
      return;
    }
    addLog(finalFood, detailDraft.mealType);
  };

  const editLog = (log: MealLog) => {
    setDetailDraft({ food: log.food, mealType: log.mealType, quantity: 1, editingLogId: log.id });
    setScreen("detail");
  };

  const deleteLog = (id: string) => {
    service.saveLogs(logs.filter((log) => log.id !== id));
    refreshSnapshot();
  };

  const completeLogin = () => {
    setAuthError(null);
    service.completeLogin(loginDraft.email);
    refreshSnapshot();
    setOnboardingDraft((current) => ({ ...current, email: loginDraft.email }));
    setScreen(profile ? "home" : "onboarding");
  };

  const startGoogleLogin = async () => {
    if (!supabaseAuth) {
      setAuthError("Supabase Auth 尚未設定完成");
      return;
    }

    setAuthBusy(true);
    setAuthError(null);
    try {
      const redirectTo = typeof window === "undefined" ? "/nutrition-mvp" : `${window.location.origin}/nutrition-mvp`;
      await supabaseAuth.signInWithGoogle(redirectTo);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google 登入失敗");
      setAuthBusy(false);
    }
  };

  const completeOnboarding = () => {
    service.saveProfile(onboardingDraft);
    refreshSnapshot();
    setScreen("home");
  };

  const logout = () => {
    setAuthError(null);
    if (supabaseAuth) {
      setAuthBusy(true);
      void supabaseAuth
        .signOut()
        .catch((error) => {
          setAuthError(error instanceof Error ? error.message : "登出失敗");
        })
        .finally(() => {
          setAuthBusy(false);
          applySessionEmail(null);
        });
      return;
    }
    service.logout();
    refreshSnapshot();
    setScreen("login");
  };

  const addOcrDraft = () => {
    const createdAt = new Date().toISOString();
    const draftFood: FoodItem = {
      id: `ocr-${Date.now()}`,
      name: ocrDraft.name,
      brand: ocrDraft.brand,
      serving: ocrDraft.serving,
      calories: Number(ocrDraft.calories) || 0,
      protein: Number(ocrDraft.protein) || 0,
      carbs: Number(ocrDraft.carbs) || 0,
      category: "packaged",
      sourceType: "user",
      createdAt,
    };
    service.saveCustomFood(draftFood);
    rememberSearch(draftFood.name);
    refreshSnapshot();
    addLog(draftFood, "點心");
  };

  const addLunchbox = () => {
    const selectedProtein = lunchboxProteinOptions.find((item) => item.id === lunchbox.protein)!;
    const selectedStarch = lunchboxStarchOptions.find((item) => item.id === lunchbox.starch)!;
    const food: FoodItem = {
      id: `lunchbox-${Date.now()}`,
      name: `${selectedProtein.label}健康餐盒`,
      brand: "MVP 估算",
      calories: lunchboxEstimate.calories,
      protein: lunchboxEstimate.protein,
      carbs: lunchboxEstimate.carbs,
      serving: `${selectedStarch.label} + ${lunchbox.vegetables.length} 樣配菜`,
      category: "meal",
      sourceType: "template",
    };
    addLog(food, "午餐");
  };

  const addBuffet = () => {
    const staple = buffetStapleOptions.find((item) => item.id === buffet.staple)!;
    const proteinCount = buffet.protein.length;
    const vegetableCount = buffet.vegetables.length;
    const food: FoodItem = {
      id: `buffet-${Date.now()}`,
      name: `自助餐組合`,
      brand: "MVP 估算",
      calories: buffetEstimate.calories,
      protein: buffetEstimate.protein,
      carbs: buffetEstimate.carbs,
      serving: `${staple.label} + ${proteinCount} 份主菜 + ${vegetableCount} 樣配菜`,
      category: "meal",
      sourceType: "template",
    };
    addLog(food, "午餐");
  };

  const addCameraMeal = () => {
    const food: FoodItem = {
      id: `camera-${Date.now()}`,
      name: '拍照辨識餐盤',
      brand: 'MVP 估算',
      calories: cameraEstimate.calories,
      protein: cameraEstimate.protein,
      carbs: cameraEstimate.carbs,
      serving: `${cameraState.items.map((item) => item.label).join(' / ')}`,
      category: 'meal',
      sourceType: 'template',
    };
    addLog(food, '午餐');
  };

  const addSelfCookMeal = () => {
    const selected = selfCookOptions.filter((item) => selfCook.selected.includes(item.id));
    const food: FoodItem = {
      id: `cook-${Date.now()}`,
      name: '自己煮組合',
      brand: 'MVP 估算',
      calories: selfCookEstimate.calories,
      protein: selfCookEstimate.protein,
      carbs: selfCookEstimate.carbs,
      serving: selected.map((item) => item.label).join(' / '),
      category: 'meal',
      sourceType: 'template',
    };
    addLog(food, '晚餐');
  };

  const startScanDemo = (result: "found" | "not-found") => {
    setScreen("scan");
    setScanState(result === "found" ? "found" : "not-found");
    setScannedFood(result === "found" ? service.findFoodByBarcode("4710203333333") ?? null : null);
  };

  return (
    <div className={pageLayout.viewportClass}>
      <div className={pageLayout.shellClass}>
        <div className={pageLayout.contentClass}>
          {pageLayout.showStatusBar ? <div /> : null}
          {screen === "login" ? (
          <LoginScreen
            draft={loginDraft}
            onChange={setLoginDraft}
            onSubmit={completeLogin}
            onGoogleLogin={startGoogleLogin}
            authBusy={authBusy}
            authError={authError}
            googleEnabled={Boolean(supabaseAuth)}
          />
        ) : null}
        {screen === "onboarding" ? (
          <OnboardingScreen
            draft={onboardingDraft}
            onChange={setOnboardingDraft}
            onSubmit={completeOnboarding}
            onSkip={() => {
              service.saveProfile(onboardingDraft);
              refreshSnapshot();
              setScreen("home");
            }}
          />
        ) : null}
        {screen === "home" ? (
          <HomeScreen
            target={activeTarget}
            profile={profile}
            logs={todayLogs}
            totals={totals}
            breakfastTotal={breakfastTotal}
            frequentFoods={frequentFoods}
            onOpenScan={() => startScanDemo("found")}
            onOpenLunchbox={() => setScreen("lunchbox")}
            onOpenOcr={() => setScreen("ocr")}
            onOpenSearch={() => setScreen("search")}
            onOpenBuffet={() => setScreen("buffet")}
            onOpenCamera={() => setScreen("camera")}
            onOpenCook={() => setScreen("cook")}
            onOpenSelector={() => setScreen("selector")}
            onOpenFavorites={() => setScreen("favorites")}
            onOpenSettings={() => { setOnboardingDraft(profile ?? defaultProfile); setScreen("settings"); }}
            onOpenHistory={() => setScreen("history")}
            onQuickAdd={(food) => openDetail(food, food.name.includes("飯糰") ? "早餐" : "點心")}
            onEditLog={editLog}
            onDeleteLog={deleteLog}
          />
        ) : null}
        {screen === "scan" ? (
          <ScanScreen
            scanState={scanState}
            scannedFood={scannedFood}
            onBack={() => setScreen("home")}
            onViewDetail={() => scannedFood && openDetail(scannedFood, "點心")}
            onAdd={() => scannedFood && addLog(scannedFood, "點心")}
            onTryOcr={() => setScreen("ocr")}
            onTrySearch={() => setScreen("search")}
            onRescanSuccess={() => startScanDemo("found")}
            onRescanFail={() => startScanDemo("not-found")}
          />
        ) : null}
        {screen === "ocr" ? (
          <OcrScreen
            draft={ocrDraft}
            onBack={() => setScreen("home")}
            onChange={setOcrDraft}
            onSubmit={addOcrDraft}
          />
        ) : null}
        {screen === "lunchbox" ? (
          <LunchboxScreen
            state={lunchbox}
            estimate={lunchboxEstimate}
            onBack={() => setScreen("home")}
            onChange={setLunchbox}
            onSubmit={addLunchbox}
          />
        ) : null}
        {screen === "search" ? (
          <SearchScreen
            query={searchQuery}
            foods={searchableFoods}
            recentSearches={recentSearches}
            recommendedFoods={frequentFoods}
            onBack={() => setScreen("home")}
            onChangeQuery={setSearchQuery}
            onSelectKeyword={openSearchKeyword}
            onSelectFood={selectSearchFood}
          />
        ) : null}
        {screen === "buffet" ? (
          <BuffetScreen
            state={buffet}
            estimate={buffetEstimate}
            onBack={() => setScreen("home")}
            onChange={setBuffet}
            onSubmit={addBuffet}
          />
        ) : null}
        {screen === "camera" ? (
          <CameraScreen
            state={cameraState}
            estimate={cameraEstimate}
            onBack={() => setScreen("home")}
            onChange={setCameraState}
            onSubmit={addCameraMeal}
          />
        ) : null}
        {screen === "cook" ? (
          <SelfCookScreen
            state={selfCook}
            estimate={selfCookEstimate}
            onBack={() => setScreen("home")}
            onChange={setSelfCook}
            onSubmit={addSelfCookMeal}
          />
        ) : null}
        {screen === "selector" ? (
          <FlowSelectorScreen
            onBack={() => setScreen("home")}
            onPick={(next) => setScreen(next)}
          />
        ) : null}
        {screen === "favorites" ? (
          <FavoritesScreen foods={frequentFoods} onBack={() => setScreen("home")} onSelectFood={(food) => openDetail(food, "點心")} />
        ) : null}
        {screen === "settings" ? (
          <SettingsScreen
            profile={resolveEditableNutritionProfile({ profile, draft: onboardingDraft })}
            onBack={() => setScreen("home")}
            onChange={setOnboardingDraft}
            onSave={() => {
              service.saveProfile(onboardingDraft);
              refreshSnapshot();
              setScreen("home");
            }}
            onLogout={logout}
          />
        ) : null}
        {screen === "detail" && detailDraft ? (
          <DetailScreen
            draft={detailDraft}
            onBack={() => setScreen("home")}
            onChange={setDetailDraft}
            onSubmit={saveDetail}
          />
        ) : null}
        {screen === "history" ? <HistoryScreen logs={todayLogs} onBack={() => setScreen("home")} onOpenSelector={() => setScreen("selector")} /> : null}
        </div>
      </div>
    </div>
  );
}

function LoginScreen({
  draft,
  onChange,
  onSubmit,
  onGoogleLogin,
  authBusy,
  authError,
  googleEnabled,
}: {
  draft: { email: string; password: string };
  onChange: (value: { email: string; password: string }) => void;
  onSubmit: () => void;
  onGoogleLogin: () => void;
  authBusy: boolean;
  authError: string | null;
  googleEnabled: boolean;
}) {
  const loginMode = getNutritionLoginMode(googleEnabled);

  return (
    <div className="space-y-5 text-[#1F1F1C] pt-8">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[24px] bg-[#E6F2E8] text-2xl">🌿</div>
        <h1 className="mt-5 text-[2rem] font-semibold tracking-[-0.03em]">開始記錄今天吃了什麼</h1>
        <p className="mt-2 text-sm leading-6 text-[#615D59]">不用很完美，先記下來就好。</p>
      </div>
      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        {loginMode.primaryCta === "google" ? (
          <button
            onClick={onGoogleLogin}
            disabled={!googleEnabled || authBusy}
            className="w-full rounded-[22px] bg-[#2FA56F] px-4 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(47,165,111,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {authBusy ? "Google 跳轉中..." : "Google 登入"}
          </button>
        ) : null}
        {loginMode.helperText ? <p className="mt-3 text-sm leading-6 text-[#615D59]">{loginMode.helperText}</p> : null}
        {loginMode.showEmailFields ? (
          <>
            <div className={loginMode.primaryCta === "google" ? "mt-5 border-t border-[#EFEAE3] pt-5" : ""}>
              <Field label={loginMode.emailLabel} value={draft.email} onChange={(value) => onChange({ ...draft, email: value })} />
              <div className="mt-3" />
              <Field label="Password" value={draft.password} onChange={(value) => onChange({ ...draft, password: value })} />
              <button onClick={onSubmit} className="mt-4 w-full rounded-[22px] border border-[#D9D6D0] px-4 py-4 text-base font-medium text-[#1F1F1C]">
                {loginMode.emailButtonLabel}
              </button>
            </div>
          </>
        ) : null}
        {loginMode.primaryCta === "email" ? (
          <button
            onClick={onGoogleLogin}
            disabled={!googleEnabled || authBusy}
            className="mt-3 w-full rounded-[22px] border border-[#D9D6D0] px-4 py-4 text-base font-medium text-[#1F1F1C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {authBusy ? "Google 跳轉中..." : "Google 登入"}
          </button>
        ) : null}
        {authError ? <p className="mt-3 text-sm text-[#C0392B]">{authError}</p> : null}
      </div>
    </div>
  );
}

function OnboardingScreen({
  draft,
  onChange,
  onSubmit,
  onSkip,
}: {
  draft: UserProfile;
  onChange: (value: UserProfile) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const goals: UserProfile['goal'][] = ['維持', '減脂', '增加蛋白質', '控碳'];
  return (
    <div className="space-y-5 text-[#1F1F1C] pt-4">
      <div>
        <h1 className="text-[1.9rem] font-semibold tracking-[-0.03em]">先幫你抓個大方向</h1>
        <p className="mt-2 text-sm leading-6 text-[#615D59]">這些之後都能改，不用一次填得很精準。</p>
      </div>
      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <ChoiceSection title="目標">
          <div className="grid grid-cols-2 gap-3">
            {goals.map((goal) => (
              <button key={goal} onClick={() => onChange({ ...draft, goal })} className={cn('rounded-[20px] px-3 py-3 text-sm font-medium', draft.goal === goal ? 'bg-[#EEF7F0] text-[#2FA56F] ring-1 ring-[#2FA56F]' : 'bg-[#F7F5F0] text-[#615D59]')}>
                {goal}
              </button>
            ))}
          </div>
        </ChoiceSection>
        <div className="grid grid-cols-3 gap-3">
          <Field label="熱量" value={String(draft.calorieTarget)} onChange={(value) => onChange({ ...draft, calorieTarget: Number(value) || 0 })} />
          <Field label="蛋白質" value={String(draft.proteinTarget)} onChange={(value) => onChange({ ...draft, proteinTarget: Number(value) || 0 })} />
          <Field label="碳水" value={String(draft.carbTarget)} onChange={(value) => onChange({ ...draft, carbTarget: Number(value) || 0 })} />
        </div>
        <button onClick={onSubmit} className="mt-4 w-full rounded-[22px] bg-[#2FA56F] px-4 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(47,165,111,0.24)]">完成設定</button>
        <button onClick={onSkip} className="mt-3 w-full rounded-[22px] border border-[#D9D6D0] px-4 py-4 text-base font-medium text-[#1F1F1C]">先略過</button>
      </div>
    </div>
  );
}

function FavoritesScreen({
  foods,
  onBack,
  onSelectFood,
}: {
  foods: FoodItem[];
  onBack: () => void;
  onSelectFood: (food: FoodItem) => void;
}) {
  return (
    <div className="space-y-4 text-[#1F1F1C]">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6"><ArrowLeft className="h-4 w-4" /></button>
        <div className="text-base font-semibold">常吃食物</div>
        <div className="w-10" />
      </div>
      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <div className="space-y-3">
          {foods.map((food) => (
            <button key={food.id} onClick={() => onSelectFood(food)} className="flex w-full items-center gap-3 rounded-[20px] bg-[#F7F5F0] px-3 py-3 text-left">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm"><FoodEmoji category={food.category} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[#1F1F1C]">{food.name}</div>
                <div className="truncate text-xs text-[#615D59]">{food.calories} kcal ・ 蛋白質 {food.protein} g</div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#615D59]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsScreen({
  profile,
  onBack,
  onChange,
  onSave,
  onLogout,
}: {
  profile: UserProfile;
  onBack: () => void;
  onChange: (value: UserProfile) => void;
  onSave: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="space-y-4 text-[#1F1F1C]">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6"><ArrowLeft className="h-4 w-4" /></button>
        <div className="text-base font-semibold">我的設定</div>
        <div className="w-10" />
      </div>
      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <Field label="Email" value={profile.email} onChange={(value) => onChange({ ...profile, email: value })} />
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Field label="熱量目標" value={String(profile.calorieTarget)} onChange={(value) => onChange({ ...profile, calorieTarget: Number(value) || 0 })} />
          <Field label="蛋白質目標" value={String(profile.proteinTarget)} onChange={(value) => onChange({ ...profile, proteinTarget: Number(value) || 0 })} />
          <Field label="碳水目標" value={String(profile.carbTarget)} onChange={(value) => onChange({ ...profile, carbTarget: Number(value) || 0 })} />
        </div>
        <button onClick={onSave} className="mt-4 w-full rounded-[22px] bg-[#2FA56F] px-4 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(47,165,111,0.24)]">儲存設定</button>
        <button onClick={onLogout} className="mt-3 w-full rounded-[22px] bg-[#FFF1F1] px-4 py-4 text-base font-medium text-[#D95C5C]">登出</button>
      </div>
    </div>
  );
}

function HomeScreen({
  target,
  profile,
  totals,
  breakfastTotal,
  frequentFoods,
  logs,
  onOpenScan,
  onOpenLunchbox,
  onOpenOcr,
  onOpenSearch,
  onOpenBuffet,
  onOpenCamera,
  onOpenCook,
  onOpenSelector,
  onOpenFavorites,
  onOpenSettings,
  onOpenHistory,
  onQuickAdd,
  onEditLog,
  onDeleteLog,
}: {
  target: { calories: number; protein: number; carbs: number };
  profile: UserProfile | null;
  totals: { calories: number; protein: number; carbs: number };
  breakfastTotal: number;
  frequentFoods: FoodItem[];
  logs: MealLog[];
  onOpenScan: () => void;
  onOpenLunchbox: () => void;
  onOpenOcr: () => void;
  onOpenSearch: () => void;
  onOpenBuffet: () => void;
  onOpenCamera: () => void;
  onOpenCook: () => void;
  onOpenSelector: () => void;
  onOpenFavorites: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onQuickAdd: (food: FoodItem) => void;
  onEditLog: (log: MealLog) => void;
  onDeleteLog: (id: string) => void;
}) {
  return (
    <div className="space-y-4 text-[#1F1F1C]">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-[#615D59]">
            <Leaf className="h-4 w-4 text-[#2FA56F]" />
            飲食紀錄助手
          </div>
          <h2 className="mt-3 text-[1.9rem] font-semibold tracking-[-0.03em]">今天吃得怎麼樣？</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-[#615D59]">{profile?.goal ?? '維持'}模式 ・ {target.calories} kcal</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenSettings} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6">
            <Bell className="h-4 w-4 text-[#2F80ED]" />
          </button>
          <button onClick={onOpenSettings} className="grid h-10 w-10 place-items-center rounded-full bg-[#E6F2E8] text-sm font-semibold text-[#2FA56F]">佐</button>
        </div>
      </div>

      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[#1F1F1C]">今日進度</span>
          <span className="text-sm text-[#2F80ED]">查看詳情</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <MetricCard label="熱量" value={`${totals.calories}`} total={`${target.calories}`} unit="kcal" color="#E6B86A" />
          <MetricCard label="蛋白質" value={`${totals.protein}`} total={`${target.protein}`} unit="g" color="#2FA56F" />
          <MetricCard label="碳水" value={`${totals.carbs}`} total={`${target.carbs}`} unit="g" color="#2F80ED" />
        </div>
        <div className="mt-4 rounded-2xl bg-[#FFF5DE] px-3 py-3 text-sm text-[#7A6733]">
          蛋白質偏低，再加點優質蛋白會更好喔！
        </div>
      </div>

      <div className="rounded-[24px] bg-[#EEF7F0] px-4 py-4 shadow-[0_10px_26px_rgba(47,165,111,0.12)] ring-1 ring-[#DDEEDF]">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-2xl shadow-sm">🌿</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#1F1F1C]">今天蛋白質有顧到，不錯。</div>
            <div className="mt-1 text-xs text-[#615D59]">小小選擇，累積大改變！</div>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#2FA56F] shadow-sm">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <SectionTitle title="快速新增" />
        <div className="mt-3 grid grid-cols-4 gap-3">
          {quickActions.map(({ key, label, icon: Icon }) => {
            const onClick =
              key === "scan"
                ? onOpenScan
                : key === "lunchbox"
                  ? onOpenLunchbox
                  : key === "ocr"
                    ? onOpenOcr
                    : key === "search"
                      ? onOpenSearch
                      : key === "buffet"
                        ? onOpenBuffet
                        : key === "camera"
                          ? onOpenCamera
                          : key === "cook"
                            ? onOpenCook
                            : key === "favorite"
                              ? onOpenFavorites
                              : onOpenHistory;
            return (
              <button key={key} onClick={onClick} className="rounded-[18px] bg-[#F7F5F0] px-2 py-3 text-center">
                <Icon className="mx-auto h-5 w-5 text-[#2FA56F]" />
                <div className="mt-2 text-[11px] font-medium leading-4 text-[#1F1F1C]">{label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <SectionTitle title="最近常吃" action="看全部" onAction={onOpenFavorites} />
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {frequentFoods.map((food) => (
            <button
              key={food.id}
              onClick={() => onQuickAdd(food)}
              className="min-w-[140px] rounded-[20px] bg-[#F7F5F0] p-3 text-left"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white shadow-sm">
                  <FoodEmoji category={food.category} />
                </div>
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[#2FA56F] text-white shadow-sm">
                  <Plus className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-sm font-semibold text-[#1F1F1C]">{food.name}</div>
              <div className="mt-1 text-xs text-[#615D59]">{food.calories} kcal</div>
              <div className="mt-1 text-xs text-[#615D59]">蛋白質 {food.protein} g</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <SectionTitle title="今日紀錄" action={`總熱量 ${totals.calories} kcal`} />
        <div className="mt-3 rounded-[18px] bg-[#F7F5F0] p-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 font-semibold text-[#1F1F1C]">
              <Sparkles className="h-4 w-4 text-[#2FA56F]" />
              早餐
              <span className="font-normal text-[#615D59]">08:00</span>
            </div>
            <span className="font-semibold text-[#1F1F1C]">{breakfastTotal} kcal</span>
          </div>
          <div className="mt-3 space-y-2">
            {logs
              .filter((log) => log.mealType === "早餐")
              .map((log) => (
                <div key={log.id} className="flex items-center gap-3 rounded-[16px] bg-white px-3 py-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#F7F5F0]">
                    <FoodEmoji category={log.food.category} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[#1F1F1C]">{log.food.name}</div>
                    <div className="truncate text-xs text-[#615D59]">
                      {log.food.brand ? `${log.food.brand} ｜ ` : ""}
                      {log.food.serving}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-[#1F1F1C]">{log.food.calories} kcal</div>
                    <button onClick={() => onEditLog(log)} className="rounded-full bg-[#F7F5F0] px-2 py-1 text-[11px] text-[#615D59]">編輯</button>
                    <button onClick={() => onDeleteLog(log.id)} className="rounded-full bg-[#FFF1F1] px-2 py-1 text-[11px] text-[#D95C5C]">刪除</button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <BottomNav active="今日" onHome={undefined} onHistory={onOpenHistory} onAddRecord={onOpenSelector} onSettings={onOpenSettings} />
    </div>
  );
}

function MetricCard({ label, value, total, unit, color }: { label: string; value: string; total: string; unit: string; color: string }) {
  const numericValue = Number(value);
  const numericTotal = Number(total);
  return (
    <div className="rounded-[20px] bg-[#F7F5F0] p-3">
      <div className="text-xs text-[#615D59]">{label}</div>
      <div className="mt-2 text-[1rem] font-semibold text-[#1F1F1C]">{value}</div>
      <div className="text-[11px] text-[#615D59]">/ {total} {unit}</div>
      <div className="mt-3 h-2 rounded-full bg-white">
        <div className="h-2 rounded-full" style={barStyle(numericValue, numericTotal, color)} />
      </div>
      <div className="mt-2 text-right text-[11px] font-medium text-[#615D59]">{percent(numericValue, numericTotal)}%</div>
    </div>
  );
}

function ScanScreen({
  scanState,
  scannedFood,
  onBack,
  onViewDetail,
  onAdd,
  onTryOcr,
  onTrySearch,
  onRescanSuccess,
  onRescanFail,
}: {
  scanState: "idle" | "found" | "not-found";
  scannedFood: FoodItem | null;
  onBack: () => void;
  onViewDetail: () => void;
  onAdd: () => void;
  onTryOcr: () => void;
  onTrySearch: () => void;
  onRescanSuccess: () => void;
  onRescanFail: () => void;
}) {
  return (
    <div className="space-y-4 text-white">
      <div className="flex items-center justify-between text-[#1F1F1C]">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold">掃條碼</div>
        <div className="flex gap-2">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6">
            <Zap className="h-4 w-4 text-[#2F80ED]" />
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6">
            <ImageIcon className="h-4 w-4 text-[#1F1F1C]" />
          </button>
        </div>
      </div>

      <div className="rounded-[28px] bg-[#161616] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.25)]">
        <div className="mx-auto w-fit rounded-full bg-white/10 px-4 py-2 text-sm text-white/80">對準條碼即可自動掃描</div>
        <div className="relative mt-4 overflow-hidden rounded-[24px] border border-white/8 bg-gradient-to-b from-[#3b3b3b] to-[#1d1d1d] p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(47,128,237,0.12),transparent_28%)]" />
          <div className="relative mx-auto mt-10 h-[320px] w-[220px] rounded-[20px] bg-[#efe8de] shadow-inner">
            <div className="absolute inset-x-4 top-18 h-16 rounded-lg bg-white/70" />
            <div className="absolute inset-x-6 top-30 h-20 rounded-lg bg-[#8db1da]" />
            <div className="absolute inset-x-8 top-12 h-[180px] rounded-[18px] border-2 border-[#4F8F61]">
              <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-[#9ef0c0] shadow-[0_0_24px_rgba(158,240,192,0.8)]" />
              <div className="absolute left-0 top-0 h-10 w-10 border-l-[6px] border-t-[6px] border-[#6EE7A1]" />
              <div className="absolute right-0 top-0 h-10 w-10 border-r-[6px] border-t-[6px] border-[#6EE7A1]" />
              <div className="absolute bottom-0 left-0 h-10 w-10 border-b-[6px] border-l-[6px] border-[#6EE7A1]" />
              <div className="absolute bottom-0 right-0 h-10 w-10 border-b-[6px] border-r-[6px] border-[#6EE7A1]" />
            </div>
            <div className="absolute inset-x-10 top-[108px] flex items-end justify-center gap-[3px]">
              {Array.from({ length: 18 }).map((_, index) => (
                <span key={index} className={cn("w-[4px] rounded-sm bg-[#161616]", index % 2 === 0 ? "h-16" : "h-12")} />
              ))}
            </div>
          </div>
          <div className="relative mt-6 flex justify-center gap-3">
            <button onClick={onRescanSuccess} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 ring-1 ring-white/10">
              模擬掃到商品
            </button>
            <button onClick={onRescanFail} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 ring-1 ring-white/10">
              模擬找不到
            </button>
          </div>
          <button className="relative mx-auto mt-5 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 ring-1 ring-white/10">
            <Zap className="h-4 w-4" />
            開燈
          </button>
        </div>
      </div>

      {scanState === "found" && scannedFood ? (
        <div className="space-y-3">
          <div className="rounded-[26px] bg-white p-4 text-[#1F1F1C] shadow-[0_12px_32px_rgba(31,31,28,0.12)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2FA56F]">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#E6F2E8]">✓</span>
              找到商品！
            </div>
            <div className="mt-4 flex gap-3">
              <div className="grid h-20 w-20 place-items-center rounded-[20px] bg-[#F7F5F0] text-3xl">🥪</div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold">{scannedFood.name}</div>
                <div className="mt-1 text-sm text-[#615D59]">{scannedFood.brand}</div>
                <div className="mt-2 text-sm text-[#615D59]">{scannedFood.serving}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniMetric label="熱量" value={`${scannedFood.calories} kcal`} />
              <MiniMetric label="蛋白質" value={`${scannedFood.protein} g`} />
              <MiniMetric label="碳水化合物" value={`${scannedFood.carbs} g`} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={onViewDetail} className="rounded-2xl border border-[#D9D6D0] px-4 py-3 text-sm font-medium text-[#1F1F1C]">
                查看詳情
              </button>
              <button onClick={onAdd} className="rounded-2xl bg-[#2FA56F] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(47,165,111,0.22)]">
                加入紀錄
              </button>
            </div>
          </div>
          <button onClick={onTryOcr} className="flex w-full items-center justify-between rounded-[22px] bg-white px-4 py-4 text-left text-[#1F1F1C] shadow-[0_10px_28px_rgba(31,31,28,0.08)]">
            <div>
              <div className="font-semibold">找不到其他商品？</div>
              <div className="mt-1 text-sm text-[#615D59]">拍營養標示或用搜尋試試看</div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#615D59]" />
          </button>
        </div>
      ) : null}

      {scanState === "not-found" ? (
        <div className="space-y-3 rounded-[26px] bg-white p-4 text-[#1F1F1C] shadow-[0_12px_32px_rgba(31,31,28,0.12)]">
          <div className="text-lg font-semibold">這個商品還沒有人建過</div>
          <div className="text-sm leading-6 text-[#615D59]">沒關係，直接拍營養標示就能繼續，不會卡在這裡。</div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onTryOcr} className="rounded-2xl bg-[#2FA56F] px-4 py-3 text-sm font-semibold text-white">
              拍營養標示
            </button>
            <button onClick={onTrySearch} className="rounded-2xl border border-[#D9D6D0] px-4 py-3 text-sm font-medium text-[#1F1F1C]">
              用搜尋找
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[#F7F5F0] p-3">
      <div className="text-xs text-[#615D59]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[#1F1F1C]">{value}</div>
    </div>
  );
}

function OcrScreen({
  draft,
  onBack,
  onChange,
  onSubmit,
}: {
  draft: OcrDraft;
  onBack: () => void;
  onChange: (value: OcrDraft) => void;
  onSubmit: () => void;
}) {
  const update = (key: keyof OcrDraft, value: string) => onChange({ ...draft, [key]: value });
  return (
    <div className="space-y-4 text-[#1F1F1C]">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold">拍營養標示</div>
        <div className="w-10" />
      </div>
      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <div className="rounded-[22px] bg-[#F7F5F0] p-4 text-sm text-[#615D59]">
          掃碼找不到商品也沒關係，這裡就是你的 fallback。拍完、修一下、直接加入紀錄。
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <PhotoPlaceholder label="營養標示" />
          <PhotoPlaceholder label="商品正面（可選）" />
        </div>
        <div className="mt-4 space-y-3">
          <Field label="品名" value={draft.name} onChange={(value) => update("name", value)} />
          <Field label="品牌" value={draft.brand} onChange={(value) => update("brand", value)} />
          <Field label="每份量" value={draft.serving} onChange={(value) => update("serving", value)} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="熱量" value={draft.calories} onChange={(value) => update("calories", value)} />
            <Field label="蛋白質" value={draft.protein} onChange={(value) => update("protein", value)} />
            <Field label="碳水" value={draft.carbs} onChange={(value) => update("carbs", value)} />
          </div>
        </div>
      </div>
      <button onClick={onSubmit} className="sticky bottom-0 w-full rounded-[22px] bg-[#2FA56F] px-4 py-4 text-base font-semibold text-white shadow-[0_14px_30px_rgba(47,165,111,0.24)]">
        確認並加入紀錄
      </button>
    </div>
  );
}

function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#D8D4CD] bg-[#F7F5F0] p-4 text-center text-sm text-[#615D59]">
      <Camera className="mx-auto h-6 w-6 text-[#2F80ED]" />
      <div className="mt-2 font-medium text-[#1F1F1C]">{label}</div>
      <div className="mt-1 text-xs">MVP 先用示意圖與可編輯結果</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-[#615D59]">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[#E4E0D8] bg-[#FCFBF8] px-3 py-3 text-sm outline-none transition focus:border-[#2FA56F] focus:ring-2 focus:ring-[#2FA56F]/15"
      />
    </label>
  );
}

function LunchboxScreen({
  state,
  estimate,
  onBack,
  onChange,
  onSubmit,
}: {
  state: LunchboxState;
  estimate: { calories: number; protein: number; carbs: number };
  onBack: () => void;
  onChange: (value: LunchboxState) => void;
  onSubmit: () => void;
}) {
  const toggleMulti = (group: "vegetables" | "sauces" | "extras", id: string) => {
    const current = state[group];
    const exists = current.includes(id);
    const next = exists ? current.filter((item) => item !== id) : [...current, id];
    onChange({ ...state, [group]: next });
  };

  return (
    <div className="space-y-4 text-[#1F1F1C] pb-24">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold">健康餐盒</div>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6">
          <CircleHelp className="h-4 w-4 text-[#2F80ED]" />
        </button>
      </div>

      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <h2 className="text-[1.7rem] font-semibold tracking-[-0.03em]">今天的餐盒長怎樣？</h2>
        <p className="mt-1 text-sm text-[#615D59]">幾秒內選完，快速記錄營養！</p>

        <ChoiceSection title="1 主菜（選 1 種）">
          <ChipGrid
            items={lunchboxProteinOptions}
            selected={[state.protein]}
            onClick={(id) => onChange({ ...state, protein: id })}
          />
        </ChoiceSection>

        <ChoiceSection title="2 澱粉（選 1 種）">
          <ChipGrid
            items={lunchboxStarchOptions}
            selected={[state.starch]}
            onClick={(id) => onChange({ ...state, starch: id })}
          />
        </ChoiceSection>

        <ChoiceSection title={`3 配菜（選 2~4 種）`} action={`已選 ${state.vegetables.length} 種`}>
          <ChipGrid items={lunchboxVegetableOptions} selected={state.vegetables} onClick={(id) => toggleMulti("vegetables", id)} />
        </ChoiceSection>

        <ChoiceSection title="4 醬料">
          <ChipGrid items={lunchboxSauceOptions} selected={state.sauces} onClick={(id) => toggleMulti("sauces", id)} compact />
        </ChoiceSection>

        <ChoiceSection title="5 加料">
          <ChipGrid items={lunchboxExtraOptions} selected={state.extras} onClick={(id) => toggleMulti("extras", id)} compact />
        </ChoiceSection>

        <div className="mt-5 rounded-[24px] bg-[#F5FBF7] p-4 ring-1 ring-[#DDEEDF]">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[#1F1F1C]">營養估算</div>
            <button className="text-sm font-medium text-[#2FA56F]">重新估算</button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <EstimateTile label="熱量" value={`約 ${estimate.calories} kcal`} />
            <EstimateTile label="蛋白質" value={`約 ${estimate.protein} g`} />
            <EstimateTile label="碳水" value={`約 ${estimate.carbs} g`} />
          </div>
          <div className="mt-3 text-xs leading-5 text-[#615D59]">為估算值，實際數值會因份量與調料而異。</div>
        </div>
      </div>

      <button onClick={onSubmit} className="fixed bottom-8 left-1/2 w-[calc(100%-3rem)] max-w-[342px] -translate-x-1/2 rounded-[22px] bg-[#2FA56F] px-4 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(47,165,111,0.24)]">
        加入紀錄
      </button>
    </div>
  );
}

function ChoiceSection({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-[#1F1F1C]">{title}</div>
        {action ? <div className="text-sm font-medium text-[#2FA56F]">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ChipGrid({
  items,
  selected,
  onClick,
  compact = false,
}: {
  items: ReadonlyArray<{ id: string; label: string }>;
  selected: string[];
  onClick: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2")}>
      {items.map((item) => {
        const active = selected.includes(item.id);
        return (
          <button
            key={item.id}
            onClick={() => onClick(item.id)}
            className={cn(
              "rounded-[20px] border px-3 py-3 text-left transition",
              compact ? "min-h-[64px]" : "min-h-[74px]",
              active ? "border-[#2FA56F] bg-[#EEF7F0] shadow-[0_8px_18px_rgba(47,165,111,0.08)]" : "border-[#E4E0D8] bg-[#FCFBF8]",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium text-[#1F1F1C]">{item.label}</div>
              <span className={cn("mt-0.5 inline-block h-4 w-4 rounded-full border", active ? "border-[#2FA56F] bg-[#2FA56F]" : "border-[#CFC7BA]")} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EstimateTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-white px-3 py-3 shadow-sm ring-1 ring-[#E4EEDF]">
      <div className="text-xs text-[#615D59]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[#1F1F1C]">{value}</div>
    </div>
  );
}

function SearchScreen({
  query,
  foods,
  recentSearches,
  recommendedFoods,
  onBack,
  onChangeQuery,
  onSelectKeyword,
  onSelectFood,
}: {
  query: string;
  foods: FoodItem[];
  recentSearches: string[];
  recommendedFoods: FoodItem[];
  onBack: () => void;
  onChangeQuery: (value: string) => void;
  onSelectKeyword: (value: string) => void;
  onSelectFood: (food: FoodItem) => void;
}) {
  const showDiscovery = !query.trim();
  return (
    <div className="space-y-4 text-[#1F1F1C]">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold">搜尋食物</div>
        <div className="w-10" />
      </div>

      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <div className="flex items-center gap-3 rounded-[20px] border border-[#E4E0D8] bg-[#FCFBF8] px-4 py-3">
          <Search className="h-4 w-4 text-[#615D59]" />
          <input
            value={query}
            onChange={(event) => onChangeQuery(event.target.value)}
            placeholder="搜尋超商、全聯、飲料、常見食物"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#9B948C]"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {["雞胸", "飯糰", "豆漿", "全聯", "FamilyMart"].map((keyword) => (
            <button
              key={keyword}
              onClick={() => onSelectKeyword(keyword)}
              className="rounded-full bg-[#F7F5F0] px-3 py-2 text-xs font-medium text-[#615D59]"
            >
              {keyword}
            </button>
          ))}
        </div>
      </div>

      {showDiscovery && recentSearches.length ? (
        <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
          <SectionTitle title="最近搜尋" />
          <div className="mt-3 flex flex-wrap gap-2">
            {recentSearches.map((keyword) => (
              <button
                key={keyword}
                onClick={() => onSelectKeyword(keyword)}
                className="rounded-full bg-[#EEF7F0] px-3 py-2 text-xs font-medium text-[#2FA56F]"
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showDiscovery && recommendedFoods.length ? (
        <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
          <SectionTitle title="常吃推薦" />
          <div className="mt-3 space-y-3">
            {recommendedFoods.map((food) => (
              <button
                key={food.id}
                onClick={() => onSelectFood(food)}
                className="flex w-full items-center gap-3 rounded-[20px] bg-[#F7F5F0] px-3 py-3 text-left"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm">
                  <FoodEmoji category={food.category} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[#1F1F1C]">{food.name}</div>
                  <div className="truncate text-xs text-[#615D59]">{food.brand ? `${food.brand} ｜ ` : ""}{food.serving}</div>
                </div>
                <Star className="h-4 w-4 text-[#E6B86A]" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <SectionTitle title={`找到 ${foods.length} 筆結果`} />
        <div className="mt-3 space-y-3">
          {foods.map((food) => (
            <button
              key={food.id}
              onClick={() => onSelectFood(food)}
              className="flex w-full items-center gap-3 rounded-[20px] bg-[#F7F5F0] px-3 py-3 text-left"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm">
                <FoodEmoji category={food.category} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[#1F1F1C]">{food.name}</div>
                <div className="truncate text-xs text-[#615D59]">{food.brand ? `${food.brand} ｜ ` : ""}{food.serving}</div>
                <div className="mt-1 text-xs text-[#615D59]">{food.calories} kcal ・ 蛋白質 {food.protein} g ・ 碳水 {food.carbs} g</div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#2FA56F] text-white shadow-sm">
                <Plus className="h-4 w-4" />
              </div>
            </button>
          ))}
          {!foods.length ? (
            <div className="rounded-[20px] bg-[#F7F5F0] px-4 py-4 text-sm leading-6 text-[#615D59]">
              目前找不到這個品項。可以先去掃條碼，或直接拍營養標示建檔。
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BuffetScreen({
  state,
  estimate,
  onBack,
  onChange,
  onSubmit,
}: {
  state: BuffetState;
  estimate: { calories: number; protein: number; carbs: number };
  onBack: () => void;
  onChange: (value: BuffetState) => void;
  onSubmit: () => void;
}) {
  const toggleGroup = (group: 'protein' | 'vegetables' | 'extras', id: string) => {
    const current = state[group];
    const exists = current.includes(id);
    const next = exists ? current.filter((item) => item !== id) : [...current, id];
    onChange({ ...state, [group]: next });
  };

  return (
    <div className="space-y-4 text-[#1F1F1C] pb-24">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold">自助餐</div>
        <div className="w-10" />
      </div>

      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <h2 className="text-[1.7rem] font-semibold tracking-[-0.03em]">今天夾了哪些？</h2>
        <p className="mt-1 text-sm text-[#615D59]">先抓大方向，10 秒內完成就夠了。</p>

        <ChoiceSection title="1 主食（選 1 種）">
          <ChipGrid items={buffetStapleOptions} selected={[state.staple]} onClick={(id) => onChange({ ...state, staple: id })} compact />
        </ChoiceSection>

        <ChoiceSection title={`2 主菜（可複選）`} action={`已選 ${state.protein.length} 種`}>
          <ChipGrid items={buffetProteinOptions} selected={state.protein} onClick={(id) => toggleGroup('protein', id)} />
        </ChoiceSection>

        <ChoiceSection title={`3 青菜（可複選）`} action={`已選 ${state.vegetables.length} 種`}>
          <ChipGrid items={buffetVegetableOptions} selected={state.vegetables} onClick={(id) => toggleGroup('vegetables', id)} />
        </ChoiceSection>

        <ChoiceSection title="4 其他加成">
          <ChipGrid items={buffetExtraOptions} selected={state.extras} onClick={(id) => toggleGroup('extras', id)} compact />
        </ChoiceSection>

        <div className="mt-5 rounded-[24px] bg-[#FFF7E7] p-4 ring-1 ring-[#F0E0B8]">
          <div className="text-sm font-semibold text-[#1F1F1C]">快速估算</div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <EstimateTile label="熱量" value={`約 ${estimate.calories} kcal`} />
            <EstimateTile label="蛋白質" value={`約 ${estimate.protein} g`} />
            <EstimateTile label="碳水" value={`約 ${estimate.carbs} g`} />
          </div>
          <div className="mt-3 text-xs leading-5 text-[#615D59]">自助餐變數很多，這版先幫你抓 8 成方向。</div>
        </div>
      </div>

      <button onClick={onSubmit} className="fixed bottom-8 left-1/2 w-[calc(100%-3rem)] max-w-[342px] -translate-x-1/2 rounded-[22px] bg-[#2FA56F] px-4 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(47,165,111,0.24)]">
        加入紀錄
      </button>
    </div>
  );
}

function CameraScreen({
  state,
  estimate,
  onBack,
  onChange,
  onSubmit,
}: {
  state: CameraState;
  estimate: { calories: number; protein: number; carbs: number };
  onBack: () => void;
  onChange: (value: CameraState) => void;
  onSubmit: () => void;
}) {
  const removeItem = (id: string) => onChange({ ...state, items: state.items.filter((item) => item.id !== id) });
  const addVeg = () => onChange({ ...state, items: [...state.items, { id: `veg-${Date.now()}`, label: '加一份青菜', calories: 28, protein: 2, carbs: 5 }] });
  return (
    <div className="space-y-4 text-[#1F1F1C] pb-24">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6"><ArrowLeft className="h-4 w-4" /></button>
        <div className="text-base font-semibold">拍照辨識</div>
        <div className="w-10" />
      </div>
      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <div className="rounded-[22px] bg-[linear-gradient(180deg,#f2eee7,#e1d7c7)] p-4">
          <div className="aspect-[4/3] rounded-[20px] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.7),transparent_20%),linear-gradient(180deg,#d9c6a6,#b88f67)]" />
          <div className="mt-3 text-sm text-[#615D59]">MVP 先用模擬辨識結果，重點在補正流程。</div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm font-semibold text-[#1F1F1C]">辨識結果</div>
          <button onClick={addVeg} className="text-sm font-medium text-[#2FA56F]">補一項青菜</button>
        </div>
        <div className="mt-3 space-y-3">
          {state.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-[20px] bg-[#F7F5F0] px-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#1F1F1C]">{item.label}</div>
                <div className="text-xs text-[#615D59]">{item.calories} kcal ・ 蛋白質 {item.protein} g ・ 碳水 {item.carbs} g</div>
              </div>
              <button onClick={() => removeItem(item.id)} className="rounded-full bg-[#FFF1F1] px-2 py-1 text-[11px] text-[#D95C5C]">刪除</button>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-[24px] bg-[#F5FBF7] p-4 ring-1 ring-[#DDEEDF]">
          <div className="text-sm font-semibold text-[#1F1F1C]">估算結果</div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <EstimateTile label="熱量" value={`約 ${estimate.calories} kcal`} />
            <EstimateTile label="蛋白質" value={`約 ${estimate.protein} g`} />
            <EstimateTile label="碳水" value={`約 ${estimate.carbs} g`} />
          </div>
        </div>
      </div>
      <button onClick={onSubmit} className="fixed bottom-8 left-1/2 w-[calc(100%-3rem)] max-w-[342px] -translate-x-1/2 rounded-[22px] bg-[#2FA56F] px-4 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(47,165,111,0.24)]">加入紀錄</button>
    </div>
  );
}

function SelfCookScreen({
  state,
  estimate,
  onBack,
  onChange,
  onSubmit,
}: {
  state: SelfCookState;
  estimate: { calories: number; protein: number; carbs: number };
  onBack: () => void;
  onChange: (value: SelfCookState) => void;
  onSubmit: () => void;
}) {
  const toggle = (id: string) => {
    const exists = state.selected.includes(id);
    onChange({ ...state, selected: exists ? state.selected.filter((item) => item !== id) : [...state.selected, id] });
  };
  return (
    <div className="space-y-4 text-[#1F1F1C] pb-24">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6"><ArrowLeft className="h-4 w-4" /></button>
        <div className="text-base font-semibold">自己煮</div>
        <div className="w-10" />
      </div>
      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <h2 className="text-[1.7rem] font-semibold tracking-[-0.03em]">今天自己煮了什麼？</h2>
        <p className="mt-1 text-sm text-[#615D59]">用食材快速組裝，比食譜系統簡單很多。</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {selfCookOptions.map((item) => {
            const active = state.selected.includes(item.id);
            return (
              <button key={item.id} onClick={() => toggle(item.id)} className={cn('rounded-[20px] border px-3 py-3 text-left', active ? 'border-[#2FA56F] bg-[#EEF7F0]' : 'border-[#E4E0D8] bg-[#FCFBF8]')}>
                <div className="text-sm font-semibold text-[#1F1F1C]">{item.label}</div>
                <div className="mt-1 text-xs text-[#615D59]">{item.calories} kcal ・ 蛋白質 {item.protein} g</div>
              </button>
            );
          })}
        </div>
        <div className="mt-5 rounded-[24px] bg-[#F5FBF7] p-4 ring-1 ring-[#DDEEDF]">
          <div className="text-sm font-semibold text-[#1F1F1C]">目前組合</div>
          <div className="mt-2 text-sm text-[#615D59]">{selfCookOptions.filter((item) => state.selected.includes(item.id)).map((item) => item.label).join(' / ') || '還沒選食材'}</div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <EstimateTile label="熱量" value={`約 ${estimate.calories} kcal`} />
            <EstimateTile label="蛋白質" value={`約 ${estimate.protein} g`} />
            <EstimateTile label="碳水" value={`約 ${estimate.carbs} g`} />
          </div>
        </div>
      </div>
      <button onClick={onSubmit} className="fixed bottom-8 left-1/2 w-[calc(100%-3rem)] max-w-[342px] -translate-x-1/2 rounded-[22px] bg-[#2FA56F] px-4 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(47,165,111,0.24)]">加入紀錄</button>
    </div>
  );
}

function FlowSelectorScreen({
  onBack,
  onPick,
}: {
  onBack: () => void;
  onPick: (screen: Screen) => void;
}) {
  const items: Array<{ screen: Screen; label: string; desc: string }> = [
    { screen: 'scan', label: '掃條碼', desc: '超商、全聯最快' },
    { screen: 'search', label: '搜尋食物', desc: '知道名字就直接找' },
    { screen: 'ocr', label: '拍營養標示', desc: '找不到商品就用這個' },
    { screen: 'camera', label: '拍照辨識', desc: '先猜候選，再快速補正' },
    { screen: 'lunchbox', label: '健康餐盒', desc: '幾秒內選完' },
    { screen: 'buffet', label: '自助餐', desc: '先抓 8 成方向' },
    { screen: 'cook', label: '自己煮', desc: '用食材快速組裝' },
  ];
  return (
    <div className="space-y-4 text-[#1F1F1C]">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6"><ArrowLeft className="h-4 w-4" /></button>
        <div className="text-base font-semibold">新增紀錄</div>
        <div className="w-10" />
      </div>
      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <h2 className="text-[1.7rem] font-semibold tracking-[-0.03em]">你想怎麼記？</h2>
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <button key={item.label} onClick={() => onPick(item.screen)} className="flex w-full items-center justify-between rounded-[20px] bg-[#F7F5F0] px-4 py-4 text-left">
              <div>
                <div className="text-sm font-semibold text-[#1F1F1C]">{item.label}</div>
                <div className="mt-1 text-xs text-[#615D59]">{item.desc}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#615D59]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailScreen({
  draft,
  onBack,
  onChange,
  onSubmit,
}: {
  draft: DetailDraft;
  onBack: () => void;
  onChange: (value: DetailDraft) => void;
  onSubmit: () => void;
}) {
  const updateQuantity = (next: number) => {
    onChange({ ...draft, quantity: Math.max(0.5, Math.min(3, next)) });
  };

  return (
    <div className="space-y-4 text-[#1F1F1C] pb-24">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold">份量調整</div>
        <div className="w-10" />
      </div>

      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-[20px] bg-[#F7F5F0] text-2xl">
            <FoodEmoji category={draft.food.category} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-[#1F1F1C]">{draft.food.name}</div>
            <div className="truncate text-sm text-[#615D59]">{draft.food.brand ? `${draft.food.brand} ｜ ` : ''}{draft.food.serving}</div>
          </div>
        </div>

        <div className="mt-5 rounded-[22px] bg-[#F7F5F0] p-4">
          <div className="text-sm font-semibold text-[#1F1F1C]">份量</div>
          <div className="mt-3 flex items-center justify-between">
            <button onClick={() => updateQuantity(draft.quantity - 0.5)} className="grid h-11 w-11 place-items-center rounded-full bg-white text-lg shadow-sm">－</button>
            <div className="text-center">
              <div className="text-2xl font-semibold text-[#1F1F1C]">{draft.quantity} 份</div>
              <div className="mt-1 text-xs text-[#615D59]">大方向對就好，不用糾結小數點</div>
            </div>
            <button onClick={() => updateQuantity(draft.quantity + 0.5)} className="grid h-11 w-11 place-items-center rounded-full bg-[#2FA56F] text-lg text-white shadow-sm">＋</button>
          </div>
        </div>

        <ChoiceSection title="餐別">
          <div className="grid grid-cols-4 gap-2">
            {(["早餐", "午餐", "晚餐", "點心"] as MealType[]).map((mealType) => (
              <button
                key={mealType}
                onClick={() => onChange({ ...draft, mealType })}
                className={cn(
                  "rounded-[18px] px-3 py-3 text-sm font-medium",
                  draft.mealType === mealType ? "bg-[#EEF7F0] text-[#2FA56F] ring-1 ring-[#2FA56F]" : "bg-[#F7F5F0] text-[#615D59]",
                )}
              >
                {mealType}
              </button>
            ))}
          </div>
        </ChoiceSection>

        <div className="mt-5 rounded-[24px] bg-[#F5FBF7] p-4 ring-1 ring-[#DDEEDF]">
          <div className="text-sm font-semibold text-[#1F1F1C]">更新後預估</div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <EstimateTile label="熱量" value={`${scaleFood(draft.food, draft.quantity).calories} kcal`} />
            <EstimateTile label="蛋白質" value={`${scaleFood(draft.food, draft.quantity).protein} g`} />
            <EstimateTile label="碳水" value={`${scaleFood(draft.food, draft.quantity).carbs} g`} />
          </div>
        </div>
      </div>

      <button onClick={onSubmit} className="fixed bottom-8 left-1/2 w-[calc(100%-3rem)] max-w-[342px] -translate-x-1/2 rounded-[22px] bg-[#2FA56F] px-4 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(47,165,111,0.24)]">
        {draft.editingLogId ? '儲存修改' : '加入紀錄'}
      </button>
    </div>
  );
}

function HistoryScreen({ logs, onBack, onOpenSelector }: { logs: MealLog[]; onBack: () => void; onOpenSelector: () => void }) {
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const totalCalories = logs.reduce((sum, log) => sum + log.food.calories, 0);
  const totalProtein = logs.reduce((sum, log) => sum + log.food.protein, 0);
  const totalCarbs = logs.reduce((sum, log) => sum + log.food.carbs, 0);
  const grouped = logs.reduce<Record<string, MealLog[]>>((acc, log) => {
    const key = log.mealType;
    acc[key] = acc[key] ? [...acc[key], log] : [log];
    return acc;
  }, {});

  return (
    <div className="space-y-4 text-[#1F1F1C]">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/6">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold">歷史紀錄</div>
        <div className="w-10" />
      </div>
      <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
        <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-[#F7F5F0] p-1">
          <button onClick={() => setMode('day')} className={cn('rounded-[14px] px-3 py-2 text-sm font-medium', mode === 'day' ? 'bg-white text-[#1F1F1C] shadow-sm' : 'text-[#615D59]')}>
            日視圖
          </button>
          <button onClick={() => setMode('week')} className={cn('rounded-[14px] px-3 py-2 text-sm font-medium', mode === 'week' ? 'bg-white text-[#1F1F1C] shadow-sm' : 'text-[#615D59]')}>
            週摘要
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <EstimateTile label={mode === 'day' ? '今日熱量' : '本週平均'} value={`${mode === 'day' ? totalCalories : Math.round(totalCalories / 7)} kcal`} />
          <EstimateTile label="蛋白質" value={`${mode === 'day' ? totalProtein : Math.round((totalProtein / 7) * 10) / 10} g`} />
          <EstimateTile label="碳水" value={`${mode === 'day' ? totalCarbs : Math.round((totalCarbs / 7) * 10) / 10} g`} />
        </div>

        <div className="mt-4 rounded-[20px] bg-[#EEF7F0] px-4 py-3 text-sm text-[#3F7850]">
          {mode === 'day' ? '今天有持續記錄，已經很不錯。' : '這週先看趨勢，不用追求每天都完美。'}
        </div>

        <div className="mt-4 space-y-3">
          {Object.entries(grouped).map(([mealType, items]) => (
            <div key={mealType} className="rounded-[20px] bg-[#F7F5F0] p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[#1F1F1C]">{mealType}</div>
                <div className="text-xs text-[#615D59]">{items.reduce((sum, item) => sum + item.food.calories, 0)} kcal</div>
              </div>
              <div className="mt-2 space-y-2">
                {items.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 rounded-[16px] bg-white px-3 py-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#F7F5F0]">
                      <FoodEmoji category={log.food.category} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[#1F1F1C]">{log.food.name}</div>
                      <div className="truncate text-xs text-[#615D59]">{log.food.serving}</div>
                    </div>
                    <div className="text-sm font-semibold text-[#1F1F1C]">{log.food.calories} kcal</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav active="歷史" onHome={onBack} onHistory={undefined} onAddRecord={onOpenSelector} onSettings={onBack} />
    </div>
  );
}

function BottomNav({ active, onHome, onHistory, onAddRecord, onSettings }: { active: "今日" | "歷史"; onHome?: () => void; onHistory?: () => void; onAddRecord?: () => void; onSettings?: () => void }) {
  return (
    <div className="rounded-[26px] bg-white px-4 py-3 shadow-[0_12px_28px_rgba(31,31,28,0.08)] ring-1 ring-black/5">
      <div className="grid grid-cols-5 items-end text-center text-[11px] text-[#615D59]">
        <button onClick={onHome} className={cn("grid justify-items-center gap-1", active === "今日" ? "text-[#2FA56F]" : undefined)}>
          <House className="h-4 w-4" />
          今日
        </button>
        <div className="grid justify-items-center gap-1">
          <NotebookPen className="h-4 w-4" />
          紀錄
        </div>
        <button onClick={onAddRecord} className="grid justify-items-center gap-1 -translate-y-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-[#2FA56F] text-white shadow-[0_14px_26px_rgba(47,165,111,0.26)]">
            <Plus className="h-5 w-5" />
          </div>
          <span className="font-medium text-[#1F1F1C]">新增紀錄</span>
        </button>
        <button onClick={onHistory} className={cn("grid justify-items-center gap-1", active === "歷史" ? "text-[#2FA56F]" : undefined)}>
          <ChartColumn className="h-4 w-4" />
          歷史
        </button>
        <button onClick={onSettings} className="grid justify-items-center gap-1">
          <Star className="h-4 w-4" />
          我的
        </button>
      </div>
    </div>
  );
}
