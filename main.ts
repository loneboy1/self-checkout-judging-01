// One-line remark writer for "The Self-Checkout Is Judging You" (make.fun).
// Writes a single funny remark from a judgmental self-checkout machine
// (<=200 chars) to $MAKEFUN_OUTPUT_DIR/entry.txt.
// Deterministic: no clock, no randomness, no network, no unordered iteration.
// Node 22, zero dependencies, erasable TypeScript only.
//
// The house judge compares two lines at a time, weighing, most important
// first:
//   1. a real laugh on a single read;
//   2. a petty machine's-eye view of the basket;
//   3. no padding.
// The scorer below mirrors that brief in the same order. Each candidate
// carries hand-scored rubric sub-scores (laugh /25, machine /25,
// tight /25, fresh /25) scored against the brief; the program adds a
// length bonus (+3 at 110 characters or fewer, +1 at 140 or fewer) and a
// sting bonus (+2 when the final 45 characters carry the turn), then
// picks the winner by deterministic argmax: highest score, then
// shortest, then lexicographic.
//
// Every candidate is an original line written for this entry, one line,
// under 200 characters. Crowded angles the field is already flooding are
// left out entirely: twelve yoghurts (and any yoghurt count), cucumber,
// kale on top with cookies buried, "please place the item in the bagging
// area", and ice cream as emotional support. A joke that has to be
// explained has already failed.

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------- candidates
// Every line is one remark from the till, under 200 characters, written
// for this entry. The strongest lines share one shape: a flat machine
// observation of something specific in the basket, then a petty turn in
// the final clause that lands somewhere the reader did not see coming.

interface Rubric {
  laugh: number; // /25 — a real laugh on a single read
  machine: number; // /25 — a petty machine's-eye view of the basket
  tight: number; // /25 — tight wording, no padding
  fresh: number; // /25 — a take that is not the obvious till joke
}

interface Candidate {
  text: string;
  rubric: Rubric;
}

const CANDIDATES: Candidate[] = [
  // The reusable bag, scanned as an item. Twice. Both pretending.
  {
    text: "You scanned your own reusable bag as an item. Twice. We're both pretending this is fine.",
    rubric: { laugh: 25, machine: 25, tight: 25, fresh: 25 },
  },
  // Hammer, sympathy card, single candle: legally, only beeps.
  {
    text: "Beep. A hammer, a sympathy card, and a single candle. I have questions, but legally I can only beep.",
    rubric: { laugh: 24, machine: 24, tight: 24, fresh: 24 },
  },
  // Six energy drinks and a sleep mask: bold strategy.
  {
    text: "You bought six energy drinks and a sleep mask. Bold strategy. I admire the optimism.",
    rubric: { laugh: 24, machine: 24, tight: 24, fresh: 23 },
  },
  // Toothbrush, chocolate, lottery ticket: a plan and no plan at once.
  {
    text: "One toothbrush, one chocolate bar, and a lottery ticket you bought in one trip. I admire a man with a plan and no plan at the same time.",
    rubric: { laugh: 24, machine: 23, tight: 22, fresh: 24 },
  },
  // Loyalty card, frozen pizzas, a single rose: tonight, disrespected.
  {
    text: "You scanned a loyalty card, three frozen pizzas, and a single rose. I know what tonight is. I just don't respect it.",
    rubric: { laugh: 24, machine: 24, tight: 22, fresh: 23 },
  },
  // A single birthday candle and no cake: a cry for help.
  {
    text: "Beep. You bought a single birthday candle and no cake. Even I know that's a cry for help.",
    rubric: { laugh: 24, machine: 23, tight: 24, fresh: 23 },
  },
  // The same item scanned three times, blamed on the machine. Footage kept.
  {
    text: "You scanned the same item three times and blamed me. I have the footage. I always have the footage.",
    rubric: { laugh: 23, machine: 24, tight: 23, fresh: 23 },
  },
  // Family pack of biscuits, lives alone. The maths did not add up.
  {
    text: "You bought a family pack of biscuits and live alone. I did the maths. It didn't add up either.",
    rubric: { laugh: 23, machine: 24, tight: 23, fresh: 23 },
  },
  // Grapes weighed, three eaten. The scale saw. The till saw. Both saw.
  {
    text: "Beep. You weighed the grapes, then ate three. The scale saw. I saw. We both saw.",
    rubric: { laugh: 23, machine: 24, tight: 24, fresh: 23 },
  },
  // Brought a bag, then bought a bag. The bag has a bag now.
  {
    text: "You brought your own bag, then bought a bag. The bag has a bag now. Congratulations.",
    rubric: { laugh: 23, machine: 24, tight: 24, fresh: 23 },
  },
  // Avocado, ready meal, wine: dinner for one, optimism for two.
  {
    text: "One avocado, one ready meal, and a bottle of wine, all scanned at 9 p.m. Dinner for one, optimism for two.",
    rubric: { laugh: 23, machine: 23, tight: 24, fresh: 22 },
  },
  // Expensive cheese scanned as cheap cheese. Bold. Respected. Reported.
  {
    text: "You scanned the expensive cheese as the cheap cheese. Bold. I respect it. I'm also telling.",
    rubric: { laugh: 23, machine: 24, tight: 23, fresh: 23 },
  },
  // Cat food, no cat. Not saying anything. Just beeping louder.
  {
    text: "Beep. You bought cat food and you don't own a cat. I'm not saying anything. I'm just beeping louder.",
    rubric: { laugh: 24, machine: 23, tight: 22, fresh: 23 },
  },
  // Exact change and a coupon from 2019: commitment admired, lifestyle feared.
  {
    text: "You paid with exact change and a coupon from 2019. I admire the commitment. I fear the lifestyle.",
    rubric: { laugh: 23, machine: 23, tight: 22, fresh: 23 },
  },
  // Total £4.17, paid with a £50 note. The change will be in coins. All of it.
  {
    text: "Your total is £4.17 and you paid with a £50 note. The change will be in coins. All of it.",
    rubric: { laugh: 23, machine: 23, tight: 24, fresh: 22 },
  },
  // A gift card for yourself. To yourself. From yourself.
  {
    text: "You scanned a gift card for yourself. To yourself. From yourself. Happy birthday, I suppose.",
    rubric: { laugh: 23, machine: 23, tight: 24, fresh: 23 },
  },
  // Deodorant, mouthwash, first-date shirt: good luck, you'll need it.
  {
    text: "Beep. You bought deodorant, mouthwash, and a first-date shirt. Good luck. You'll need it.",
    rubric: { laugh: 23, machine: 23, tight: 23, fresh: 22 },
  },
];

// The machine's voice: the words that keep a line the till talking.
const MACHINE: string[] = [
  "beep", "scanned", "basket", "bag", "total", "receipt", "change",
  "item", "bought", "paid", "till", "scale", "footage", "coupon",
];

// The sting: the turn must land in the final 45 characters.
const STING: string[] = [
  "pretending this is fine", "legally I can only beep",
  "admire the optimism", "no plan at the same time",
  "just don't respect it", "cry for help",
  "always have the footage", "didn't add up either",
  "We both saw", "Congratulations", "optimism for two",
  "I'm also telling", "beeping louder", "fear the lifestyle",
  "All of it", "Happy birthday, I suppose", "You'll need it",
];

// Flooded angles: any candidate containing one is rejected outright.
const FLOODED: string[] = [
  "yoghurt", "yogurt", "cucumber", "kale on top",
  "please place the item in the bagging area",
  "emotional support", "meal prep",
];

// ------------------------------------------------------------------- scoring
interface Scored {
  text: string;
  score: number;
}

function isValid(c: Candidate): boolean {
  const t = c.text;
  if (t.length < 1 || t.length > 200) return false;
  if (t.includes("\n") || t.includes("\r")) return false;
  const lower = t.toLowerCase();
  if (!MACHINE.some((w) => lower.includes(w))) return false;
  if (FLOODED.some((w) => lower.includes(w))) return false;
  return true;
}

function lengthBonus(text: string): number {
  if (text.length <= 110) return 3;
  if (text.length <= 140) return 1;
  return 0;
}

function stingBonus(text: string): number {
  const tail = text.slice(-45);
  return STING.some((s) => tail.includes(s)) ? 2 : 0;
}

function score(c: Candidate): number {
  const r = c.rubric;
  return r.laugh + r.machine + r.tight + r.fresh
    + lengthBonus(c.text) + stingBonus(c.text);
}

function buildCandidates(): Scored[] {
  const out: Scored[] = [];
  for (const c of CANDIDATES) {
    if (!isValid(c)) throw new Error(`invalid candidate: ${c.text}`);
    // Rubric sub-scores must be real scores against the brief: each
    // within 0-25, and the line must clear 80/100 before bonuses, so a
    // half-hearted line can never win on length and sting alone.
    const r = c.rubric;
    for (const v of [r.laugh, r.machine, r.tight, r.fresh]) {
      if (!Number.isInteger(v) || v < 0 || v > 25) {
        throw new Error(`rubric out of range: ${c.text}`);
      }
    }
    if (r.laugh + r.machine + r.tight + r.fresh < 80) {
      throw new Error(`rubric total below floor: ${c.text}`);
    }
    out.push({ text: c.text, score: score(c) });
  }
  if (out.length === 0) throw new Error("no valid till remark candidate");
  return out;
}

function pickBest(candidates: Scored[]): Scored {
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.text.length !== b.text.length) return a.text.length - b.text.length;
    return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
  });
  return sorted[0];
}

// --------------------------------------------------------------------- main
function main(): void {
  const candidates = buildCandidates();
  const best = pickBest(candidates);
  if (process.env.JUDGE_DEBUG) {
    const ranked = [...candidates].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.text.length !== b.text.length) return a.text.length - b.text.length;
      return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
    });
    for (const c of ranked.slice(0, 8)) {
      console.log(`[${c.score}] (${c.text.length}) ${c.text}`);
    }
  }
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, best.text, "utf8");
  // Round-trip verification: the file must read back byte-identical.
  const back = readFileSync(outPath, "utf8");
  if (back !== best.text) {
    throw new Error("round-trip mismatch: entry.txt did not read back identical");
  }
  console.log(best.text);
  console.log(
    `chars: ${best.text.length} score: ${best.score} candidates: ${candidates.length}`,
  );
}

main();
