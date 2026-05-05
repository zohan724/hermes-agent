export interface ParsedListingCard {
  tokenId: string;
  sellerShort: string;
  priceEth: number;
}

export interface ListingSummary {
  id: string;
  seller: string;
  priceWei: string;
  positionContract: string;
}

export type OptionalTraitName = "horn" | "accessories" | "wings" | "hair" | "tail";
export type TraitFieldName =
  | "body"
  | "eyes"
  | "hair"
  | "horn"
  | "wings"
  | "tail"
  | "legsBack"
  | "legsFront"
  | "accessories"
  | "ground";
export type ColorFieldName =
  | "backGroundColor"
  | "bodyColor"
  | "eyesColor"
  | "hairColor"
  | "hornColor"
  | "groundColor"
  | "accessoriesColor"
  | "tailColor";

export type RarityTraitInput = OptionalTraitInput & Partial<Record<TraitFieldName | ColorFieldName, number | null>>;

export interface OptionalTraitInput {
  horn?: number | null;
  accessories?: number | null;
  wings?: number | null;
  hair?: number | null;
  tail?: number | null;
}

export interface OptionalRarityResult {
  probability: number;
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  breakdown: Record<OptionalTraitName, { present: boolean; probability: number }>;
}

export interface CollectionEntry {
  tokenId: string;
  traits: RarityTraitInput;
  listingId?: string;
}

export interface ListingIdentity {
  id: string;
}

export interface CollectionStats {
  total: number;
  counts: Record<string, Map<number, number>>;
}

export interface CompositeRarityResult {
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  reasons: string[];
  components: {
    optional: number;
    trait: number;
    color: number;
  };
}

export interface RankFilter {
  maxRank: number;
}

export type Grade = "S" | "A" | "B" | "C" | "D";

const GRADES: Grade[] = ["S", "A", "B", "C", "D"];

const OPTIONAL_TRAIT_PROBABILITIES: Record<OptionalTraitName, number> = {
  horn: 0.2,
  accessories: 0.3,
  wings: 0.3,
  hair: 0.8,
  tail: 0.8,
};

const TRAIT_FIELDS: TraitFieldName[] = [
  "body",
  "eyes",
  "hair",
  "horn",
  "wings",
  "tail",
  "legsBack",
  "legsFront",
  "accessories",
  "ground",
];

const TRAIT_WEIGHTS: Record<TraitFieldName, number> = {
  body: 1.8,
  eyes: 1,
  hair: 1.5,
  horn: 1.6,
  wings: 1.6,
  tail: 1.4,
  legsBack: 0.6,
  legsFront: 0.6,
  accessories: 0.9,
  ground: 0.35,
};

const COLOR_WEIGHTS: Record<ColorFieldName, number> = {
  backGroundColor: 1,
  bodyColor: 1.2,
  eyesColor: 1,
  hairColor: 0.9,
  hornColor: 0.9,
  groundColor: 0.5,
  accessoriesColor: 0.6,
  tailColor: 0.8,
};

const COLOR_FIELDS: ColorFieldName[] = [
  "backGroundColor",
  "bodyColor",
  "eyesColor",
  "hairColor",
  "hornColor",
  "groundColor",
  "accessoriesColor",
  "tailColor",
];

const MOST_COMMON_OPTIONAL_PROBABILITY = 0.8 * 0.7 * 0.7 * 0.8 * 0.8;
const MOST_RARE_OPTIONAL_PROBABILITY = 0.2 * 0.3 * 0.3 * 0.2 * 0.2;
const PRICE_WEI_SCALE = 1_000_000_000_000_000_000;

export function parseListingCardText(text: string): ParsedListingCard {
  const compact = text.replace(/\s+/g, "").trim();
  const match = compact.match(/uPeg#(\d+)(0x[a-fA-F0-9]{4}…[a-fA-F0-9]{4})([\d.]+)ETH(?:BUY|Buy)?/i);
  if (!match) {
    throw new Error(`Unable to parse Peg2Peg card text: ${text}`);
  }

  return {
    tokenId: match[1],
    sellerShort: match[2],
    priceEth: Number(match[3]),
  };
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function matchCardsToListings(cards: ParsedListingCard[], listings: ListingSummary[]) {
  const remaining = [...listings];

  return cards.flatMap((card) => {
    const index = remaining.findIndex((listing) => {
      const sellerMatches = shortenAddress(listing.seller).toLowerCase() === card.sellerShort.toLowerCase();
      const priceMatches = weiToEth(listing.priceWei) === card.priceEth;
      return sellerMatches && priceMatches;
    });

    if (index === -1) {
      return [];
    }

    const [listing] = remaining.splice(index, 1);
    return [{ card, listing }];
  });
}

export function computeOptionalRarity(traits: OptionalTraitInput): OptionalRarityResult {
  const breakdown = {} as OptionalRarityResult["breakdown"];
  let probability = 1;

  for (const traitName of Object.keys(OPTIONAL_TRAIT_PROBABILITIES) as OptionalTraitName[]) {
    const present = Number(traits[traitName] ?? 0) > 0;
    const traitProbability = OPTIONAL_TRAIT_PROBABILITIES[traitName];
    const observedProbability = present ? traitProbability : 1 - traitProbability;
    probability *= observedProbability;
    breakdown[traitName] = {
      present,
      probability: observedProbability,
    };
  }

  const score = normalizeProbabilityToScore(probability);

  return {
    probability,
    score,
    grade: scoreToGrade(score),
    breakdown,
  };
}

export function buildCollectionStats(entries: CollectionEntry[]): CollectionStats {
  const counts: Record<string, Map<number, number>> = {};

  for (const entry of entries) {
    for (const [field, rawValue] of Object.entries(entry.traits)) {
      if (rawValue == null) continue;
      const value = Number(rawValue);
      counts[field] ??= new Map<number, number>();
      counts[field].set(value, (counts[field].get(value) ?? 0) + 1);
    }
  }

  return {
    total: entries.length,
    counts,
  };
}

export function computeCompositeRarity(entry: CollectionEntry, stats: CollectionStats): CompositeRarityResult {
  const optional = computeOptionalRarity(entry.traits).score;
  const traitSignals = collectFrequencySignals(entry.traits, stats, TRAIT_FIELDS, TRAIT_WEIGHTS);
  const colorSignals = collectFrequencySignals(entry.traits, stats, COLOR_FIELDS, COLOR_WEIGHTS);
  const trait = averageWeightedContribution(traitSignals);
  const color = averageWeightedContribution(colorSignals);
  const score = Number((trait * 0.6 + optional * 0.25 + color * 0.15).toFixed(2));

  return {
    score,
    grade: scoreToGrade(score),
    reasons: buildReasons(computeOptionalRarity(entry.traits), traitSignals, colorSignals),
    components: {
      optional: Number(optional.toFixed(2)),
      trait: Number(trait.toFixed(2)),
      color: Number(color.toFixed(2)),
    },
  };
}

export function buildDatasetReusePlan(listings: ListingIdentity[], cachedEntries: CollectionEntry[] = []) {
  const cachedByListingId = new Map(
    cachedEntries
      .filter((entry): entry is CollectionEntry & { listingId: string } => Boolean(entry.listingId))
      .map((entry) => [String(entry.listingId), entry]),
  );

  const reusedEntries: CollectionEntry[] = [];
  const missingListingIds: string[] = [];

  for (const listing of listings) {
    const listingId = String(listing.id);
    const cachedEntry = cachedByListingId.get(listingId);
    if (cachedEntry) {
      reusedEntries.push(cachedEntry);
      continue;
    }
    missingListingIds.push(listingId);
  }

  return { reusedEntries, missingListingIds };
}

export function isDatasetCacheComplete(listings: ListingIdentity[], cachedEntries: CollectionEntry[] = []): boolean {
  return buildDatasetReusePlan(listings, cachedEntries).missingListingIds.length === 0;
}

export function buildListingPageOffsets(total: number, pageSize: number): number[] {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(pageSize) || pageSize <= 0) {
    return [0];
  }

  const offsets: number[] = [];
  for (let offset = 0; offset < total; offset += pageSize) {
    offsets.push(offset);
  }
  return offsets.length ? offsets : [0];
}

export function gradeFromRank(rank: number, total: number): Grade {
  if (!Number.isFinite(rank) || rank <= 0 || !Number.isFinite(total) || total <= 0) {
    return "C";
  }

  const percentile = rank / total;
  if (percentile <= 0.1) return "S";
  if (percentile <= 0.3) return "A";
  if (percentile <= 0.7) return "B";
  if (percentile <= 0.9) return "C";
  return "D";
}

export type SortMode = "price-low-to-high" | "other";

export function detectSortMode(label: string): SortMode {
  const normalized = label.trim().toLowerCase();
  return normalized.includes("price") && normalized.includes("low to high") ? "price-low-to-high" : "other";
}

export function sortCardModelsByPrice<T extends { priceEth: number }>(cards: T[], mode: SortMode): T[] {
  if (mode !== "price-low-to-high") return [...cards];
  return [...cards].sort((a, b) => a.priceEth - b.priceEth);
}

export function parseRankFilter(input: string): RankFilter | null {
  const normalized = input.trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) return null;
  const maxRank = Number(normalized);
  if (!Number.isFinite(maxRank) || maxRank <= 0) return null;
  return { maxRank };
}

export function parseGradeFilter(input: string): Grade[] | null {
  const normalized = input.trim();
  if (!normalized) return null;

  const tokens = normalized
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (tokens.includes("ALL")) return null;

  const grades = tokens.filter((value): value is Grade => GRADES.includes(value as Grade));
  const uniqueGrades = Array.from(new Set(grades));

  if (uniqueGrades.length === 0 || uniqueGrades.length === GRADES.length) {
    return null;
  }

  return uniqueGrades;
}

export function rankMatchesFilter(rank: number, filter: RankFilter | null): boolean {
  if (!filter) return true;
  return rank <= filter.maxRank;
}

export function gradeMatchesFilter(grade: Grade, filter: Grade[] | null): boolean {
  if (!filter) return true;
  return filter.includes(grade);
}

export function weiToEth(priceWei: string): number {
  return Number(priceWei) / PRICE_WEI_SCALE;
}

function normalizeProbabilityToScore(probability: number): number {
  const maxLog = Math.log(MOST_COMMON_OPTIONAL_PROBABILITY);
  const minLog = Math.log(MOST_RARE_OPTIONAL_PROBABILITY);
  const valueLog = Math.log(probability);
  const raw = ((maxLog - valueLog) / (maxLog - minLog)) * 100;
  return Number(Math.max(0, Math.min(100, raw)).toFixed(2));
}

function scoreToGrade(score: number): OptionalRarityResult["grade"] {
  if (score >= 85) return "S";
  if (score >= 65) return "A";
  if (score >= 45) return "B";
  if (score >= 20) return "C";
  return "D";
}

function averageWeightedContribution(signals: FrequencySignal[]): number {
  if (signals.length === 0) return 0;
  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = signals.reduce((sum, signal) => sum + signal.contribution * signal.weight, 0);
  return Number((weighted / totalWeight).toFixed(2));
}

interface FrequencySignal {
  field: string;
  value: number;
  frequency: number;
  contribution: number;
  weight: number;
}

function collectFrequencySignals(
  traits: RarityTraitInput,
  stats: CollectionStats,
  fields: readonly string[],
  weights: Record<string, number>,
): FrequencySignal[] {
  return fields.flatMap((field) => {
    const rawValue = traits[field as keyof RarityTraitInput];
    if (rawValue == null) return [];
    const value = Number(rawValue);
    const count = stats.counts[field]?.get(value) ?? 0;
    if (stats.total === 0 || count === 0) return [];
    const frequency = count / stats.total;
    return [{
      field,
      value,
      frequency,
      contribution: Number(((1 - frequency) * 100).toFixed(2)),
      weight: weights[field] ?? 1,
    }];
  });
}

function buildReasons(
  optional: OptionalRarityResult,
  traitSignals: FrequencySignal[],
  colorSignals: FrequencySignal[],
): string[] {
  const optionalReasons = Object.entries(optional.breakdown)
    .filter(([, detail]) => detail.probability <= 0.3)
    .map(([name, detail]) => ({
      label: formatOptionalReason(name as OptionalTraitName, detail.present),
      contribution: Number(((1 - detail.probability) * 100).toFixed(2)),
    }));

  const traitReasons = traitSignals.map((signal) => ({
    label: formatFieldReason(signal.field, signal.value),
    contribution: signal.contribution,
  }));

  const colorReasons = colorSignals.map((signal) => ({
    label: formatFieldReason(signal.field, signal.value),
    contribution: signal.contribution,
  }));

  return [...optionalReasons, ...traitReasons, ...colorReasons]
    .sort((a, b) => b.contribution - a.contribution)
    .map((item) => item.label)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 3);
}

function formatOptionalReason(name: OptionalTraitName, present: boolean): string {
  if (name === "hair" || name === "tail") {
    return present ? name : `no ${name}`;
  }
  return present ? name : `no ${name}`;
}

function formatFieldReason(field: string, value: number): string {
  const pretty = field
    .replace(/backGround/g, "background")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();

  if (pretty.includes("color")) {
    return pretty;
  }

  return `${pretty} #${value}`;
}
