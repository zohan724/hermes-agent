import { describe, expect, it } from "vitest";
import {
  buildCollectionStats,
  buildDatasetReusePlan,
  buildListingPageOffsets,
  detectSortMode,
  gradeFromRank,
  isDatasetCacheComplete,
  sortCardModelsByPrice,
  computeCompositeRarity,
  computeOptionalRarity,
  matchCardsToListings,
  parseListingCardText,
  parseGradeFilter,
  parseRankFilter,
  gradeMatchesFilter,
  rankMatchesFilter,
  shortenAddress,
} from "./core";

describe("peg2peg rarity core", () => {
  it("parses token id, seller, and ETH price from listing card text", () => {
    expect(parseListingCardText("uPeg #57583 0x6525…1b28 1 ETH BUY")).toEqual({
      tokenId: "57583",
      sellerShort: "0x6525…1b28",
      priceEth: 1,
    });
  });

  it("parses the compact text shape Peg2Peg renders inside real cards", () => {
    expect(parseListingCardText("uPeg #575830x6525…1b281ETHBuy")).toEqual({
      tokenId: "57583",
      sellerShort: "0x6525…1b28",
      priceEth: 1,
    });
  });

  it("computes the rarest optional-trait combo as an S-grade setup", () => {
    const result = computeOptionalRarity({
      horn: 5,
      accessories: 2,
      wings: 9,
      hair: 0,
      tail: 0,
    });

    expect(result.probability).toBeCloseTo(0.00072, 8);
    expect(result.grade).toBe("S");
    expect(result.score).toBeGreaterThan(95);
  });

  it("computes the most common optional-trait combo as the floor grade", () => {
    const result = computeOptionalRarity({
      horn: 0,
      accessories: 0,
      wings: 0,
      hair: 4,
      tail: 2,
    });

    expect(result.probability).toBeCloseTo(0.25088, 8);
    expect(result.grade).toBe("D");
    expect(result.score).toBe(0);
  });

  it("matches visible cards to API listings by seller and price", () => {
    const cards = [
      { tokenId: "57583", sellerShort: "0x6525…1b28", priceEth: 1 },
      { tokenId: "9846", sellerShort: "0x7f39…300f", priceEth: 0.6 },
    ];

    const listings = [
      { id: "258", seller: "0x65256e21fe4e342d46280415ce4b81077f891b28", priceWei: "1000000000000000000", positionContract: "0xbb176a7ef6103328d94073a94accffaea09a4d4a" },
      { id: "257", seller: "0x7f3953f1ba7de461f8cec6ba3741000f0ffb300f", priceWei: "600000000000000000", positionContract: "0x1136b844468a77f121696cdac958b7e74c3435c3" },
    ];

    expect(matchCardsToListings(cards, listings)).toEqual([
      {
        card: cards[0],
        listing: listings[0],
      },
      {
        card: cards[1],
        listing: listings[1],
      },
    ]);
  });

  it("shortens full addresses to the same shape used by Peg2Peg cards", () => {
    expect(shortenAddress("0x65256e21fe4e342d46280415ce4b81077f891b28")).toBe("0x6525…1b28");
  });

  it("ranks a token with rare trait values above a common one and emits concise reasons", () => {
    const stats = buildCollectionStats([
      {
        tokenId: "10",
        traits: {
          body: 1,
          eyes: 1,
          hair: 0,
          horn: 7,
          wings: 11,
          tail: 0,
          accessories: 0,
          backGroundColor: 4,
          bodyColor: 9,
          eyesColor: 2,
        },
      },
      {
        tokenId: "11",
        traits: {
          body: 1,
          eyes: 1,
          hair: 5,
          horn: 0,
          wings: 0,
          tail: 3,
          accessories: 0,
          backGroundColor: 1,
          bodyColor: 1,
          eyesColor: 1,
        },
      },
      {
        tokenId: "12",
        traits: {
          body: 1,
          eyes: 1,
          hair: 5,
          horn: 0,
          wings: 0,
          tail: 3,
          accessories: 0,
          backGroundColor: 1,
          bodyColor: 1,
          eyesColor: 1,
        },
      },
    ]);

    const rare = computeCompositeRarity(
      {
        tokenId: "10",
        traits: {
          body: 1,
          eyes: 1,
          hair: 0,
          horn: 7,
          wings: 11,
          tail: 0,
          accessories: 0,
          backGroundColor: 4,
          bodyColor: 9,
          eyesColor: 2,
        },
      },
      stats,
    );

    const common = computeCompositeRarity(
      {
        tokenId: "11",
        traits: {
          body: 1,
          eyes: 1,
          hair: 5,
          horn: 0,
          wings: 0,
          tail: 3,
          accessories: 0,
          backGroundColor: 1,
          bodyColor: 1,
          eyesColor: 1,
        },
      },
      stats,
    );

    expect(rare.score).toBeGreaterThan(common.score);
    expect(rare.components.trait).toBeGreaterThan(common.components.trait);
    expect(rare.grade < common.grade || rare.grade === "S").toBe(true);
    expect(rare.reasons).toHaveLength(3);
    expect(rare.reasons.some((reason) => /horn|no hair|wings|body color/i.test(reason))).toBe(true);
  });

  it("gives more weight to rare core body parts than to rare legs or ground", () => {
    const stats = buildCollectionStats([
      {
        tokenId: "core",
        traits: { body: 9, hair: 8, horn: 7, wings: 6, tail: 5, legsBack: 1, legsFront: 1, ground: 1, eyes: 1 },
      },
      {
        tokenId: "legs",
        traits: { body: 1, hair: 1, horn: 0, wings: 0, tail: 1, legsBack: 9, legsFront: 8, ground: 7, eyes: 1 },
      },
      {
        tokenId: "common-a",
        traits: { body: 1, hair: 1, horn: 0, wings: 0, tail: 1, legsBack: 1, legsFront: 1, ground: 1, eyes: 1 },
      },
      {
        tokenId: "common-b",
        traits: { body: 1, hair: 1, horn: 0, wings: 0, tail: 1, legsBack: 1, legsFront: 1, ground: 1, eyes: 1 },
      },
    ]);

    const coreHeavy = computeCompositeRarity(
      { tokenId: "core", traits: { body: 9, hair: 8, horn: 7, wings: 6, tail: 5, legsBack: 1, legsFront: 1, ground: 1, eyes: 1 } },
      stats,
    );
    const legsHeavy = computeCompositeRarity(
      { tokenId: "legs", traits: { body: 1, hair: 1, horn: 0, wings: 0, tail: 1, legsBack: 9, legsFront: 8, ground: 7, eyes: 1 } },
      stats,
    );

    expect(coreHeavy.components.trait).toBeGreaterThan(legsHeavy.components.trait);
    expect(coreHeavy.score).toBeGreaterThan(legsHeavy.score);
  });

  it("reuses cached listing entries and only marks missing listings for refetch", () => {
    const plan = buildDatasetReusePlan(
      [
        { id: "101" },
        { id: "102" },
        { id: "103" },
      ],
      [
        { listingId: "101", tokenId: "1", traits: { body: 1 } },
        { listingId: "103", tokenId: "3", traits: { body: 3 } },
      ],
    );

    expect(plan.reusedEntries.map((entry) => entry.listingId)).toEqual(["101", "103"]);
    expect(plan.missingListingIds).toEqual(["102"]);
  });

  it("treats cache as incomplete when even one current listing is missing", () => {
    expect(
      isDatasetCacheComplete(
        [
          { id: "101" },
          { id: "102" },
        ],
        [{ listingId: "101", tokenId: "1", traits: { body: 1 } }],
      ),
    ).toBe(false);

    expect(
      isDatasetCacheComplete(
        [
          { id: "101" },
          { id: "102" },
        ],
        [
          { listingId: "101", tokenId: "1", traits: { body: 1 } },
          { listingId: "102", tokenId: "2", traits: { body: 2 } },
        ],
      ),
    ).toBe(true);
  });

  it("builds listing page offsets so all open listings can be fetched", () => {
    expect(buildListingPageOffsets(0, 200)).toEqual([0]);
    expect(buildListingPageOffsets(200, 200)).toEqual([0]);
    expect(buildListingPageOffsets(314, 200)).toEqual([0, 200]);
    expect(buildListingPageOffsets(401, 200)).toEqual([0, 200, 400]);
  });

  it("assigns grades by rank bands so S and D always exist on larger boards", () => {
    expect(gradeFromRank(1, 100)).toBe("S");
    expect(gradeFromRank(10, 100)).toBe("S");
    expect(gradeFromRank(11, 100)).toBe("A");
    expect(gradeFromRank(35, 100)).toBe("B");
    expect(gradeFromRank(85, 100)).toBe("C");
    expect(gradeFromRank(95, 100)).toBe("D");
    expect(gradeFromRank(100, 100)).toBe("D");
  });

  it("detects low-to-high price sort labels and sorts cards ascending by price", () => {
    expect(detectSortMode("Price: low to high")).toBe("price-low-to-high");
    expect(detectSortMode("Recently listed")).toBe("other");

    const ordered = sortCardModelsByPrice(
      [
        { tokenId: "3", priceEth: 0.88 },
        { tokenId: "1", priceEth: 0.766 },
        { tokenId: "2", priceEth: 0.78 },
      ],
      "price-low-to-high",
    );

    expect(ordered.map((item) => item.tokenId)).toEqual(["1", "2", "3"]);
  });

  it("parses rank filter input and matches ranks against it", () => {
    expect(parseRankFilter("100")).toEqual({ maxRank: 100 });
    expect(parseRankFilter("  25 ")).toEqual({ maxRank: 25 });
    expect(parseRankFilter("")).toBeNull();
    expect(parseRankFilter("abc")).toBeNull();

    expect(rankMatchesFilter(12, { maxRank: 25 })).toBe(true);
    expect(rankMatchesFilter(40, { maxRank: 25 })).toBe(false);
    expect(rankMatchesFilter(40, null)).toBe(true);
  });

  it("parses grade filters and treats ALL or every grade as no filter", () => {
    expect(parseGradeFilter("A,B")).toEqual(["A", "B"]);
    expect(parseGradeFilter(" c , d ")).toEqual(["C", "D"]);
    expect(parseGradeFilter("all")).toBeNull();
    expect(parseGradeFilter("ALL,A")).toBeNull();
    expect(parseGradeFilter("S,A,B,C,D")).toBeNull();
    expect(parseGradeFilter("")).toBeNull();

    expect(gradeMatchesFilter("A", ["A", "B"])).toBe(true);
    expect(gradeMatchesFilter("C", ["A", "B"])).toBe(false);
    expect(gradeMatchesFilter("D", null)).toBe(true);
  });
});
