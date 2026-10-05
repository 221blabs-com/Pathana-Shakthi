// Run with: npx tsx --test src/components/learnplay/sims/sims.test.ts
// Every simulation's challenge rounds: valid, distinct answers, nothing broken.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as maths from "./mathsSims";
import * as physics from "./physicsSims";
import * as chem from "./chemBioSims";
import * as earth from "./earthSims";
import type { ChallengeRound } from "./simKit";

const GRADES = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
const makers: Record<string, (grade: string) => ChallengeRound> = {
  integers: (g) => maths.integersRound(g),
  fractions: (g) => maths.fractionsRound(g),
  balance: () => maths.balanceRound(),
  triangles: () => maths.triangleRound(),
  graphsLine: (g) => maths.graphRound(g, "line"),
  graphsPair: (g) => maths.graphRound(g, "pair"),
  quadratic: (g) => maths.graphRound(g, "quadratic"),
  trig: () => maths.trigRound(),
  probability: () => maths.probabilityRound(),
  sets: () => maths.vennRound(),
  circuit: (g) => physics.circuitRound(g),
  magnet: (g) => physics.magnetRound(g),
  motion: (g) => physics.motionRound(g),
  refraction: () => physics.refractionRound(),
  lens: () => physics.lensRound(),
  acids: (g) => chem.acidsRound(g),
  atom: (g) => chem.atomRound(g),
  photosynthesis: () => chem.photosynthesisRound(),
  heart: () => chem.heartRound(),
  solar: () => earth.solarRound(),
  globe: () => earth.globeRound(),
  seasons: () => earth.seasonsRound(),
  freedom: () => earth.timelineRound("freedom"),
  telangana: () => earth.timelineRound("telangana"),
};

test("challenge rounds always have 2-4 distinct options and one right answer", () => {
  for (const [name, make] of Object.entries(makers)) {
    for (const grade of GRADES) {
      for (let i = 0; i < 150; i++) {
        const r = make(grade);
        const where = `${name} ${grade}: ${r.prompt} [${r.options.join(" | ")}]`;
        assert.ok(r.options.length >= 2 && r.options.length <= 4, where);
        assert.equal(new Set(r.options).size, r.options.length, `duplicate option — ${where}`);
        assert.ok(Number.isInteger(r.correct) && r.correct >= 0 && r.correct < r.options.length, where);
        for (const text of [r.prompt, r.explain, ...r.options]) {
          assert.ok(text && !/NaN|undefined|Infinity|null/.test(text), `bad text — ${where}: ${text}`);
        }
        for (const set of r.prompt.match(/\{[^}]*\}/g) || []) {
          const items = set.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean);
          assert.equal(new Set(items).size, items.length, `repeated element in ${set} — ${where}`);
        }
        assert.equal(typeof r.visual, "function");
      }
    }
  }
});

test("physics and chemistry helpers give textbook answers", () => {
  // Lens formula 1/v − 1/u = 1/f: object at 2F of a 10 cm convex lens → image at 2F, same size.
  const img = physics.lensImage(-20, 10)!;
  assert.ok(Math.abs(img.v - 20) < 1e-9 && Math.abs(img.m + 1) < 1e-9);
  assert.equal(physics.describeImage(img.v, img.m), "Real, inverted, same size");
  assert.equal(physics.describeImage(physics.lensImage(-5, 10)!.v, physics.lensImage(-5, 10)!.m), "Virtual, erect, magnified");
  assert.deepEqual(chem.shellsFor(11), [2, 8, 1]);
  assert.deepEqual(chem.shellsFor(20), [2, 8, 8, 2]);
  assert.equal(chem.valencyFor(8), 2);
  assert.equal(chem.valencyFor(18), 0);
  assert.deepEqual(chem.groupPeriodFor(17), { group: 17, period: 3 });
  assert.deepEqual(chem.groupPeriodFor(12), { group: 2, period: 3 });
  assert.equal(chem.indicatorResult("blue-litmus", 2).words, "blue litmus turns red");
  assert.equal(chem.indicatorResult("turmeric", 10).words, "turmeric turns red");
  assert.equal(chem.indicatorResult("phenolphthalein", 7).words, "phenolphthalein stays colourless");
  assert.equal(chem.photosynthesisRate(20, 6, false), 0);
  assert.ok(chem.photosynthesisRate(10, 6, true) > chem.photosynthesisRate(40, 6, true));
  // Hyderabad (17.4° N): ~13 h of daylight on 21 June, ~11 h on 22 December, ~12 h at the equinox.
  const june = earth.dayLength(earth.HYDERABAD.lat, earth.declination(172));
  const dec = earth.dayLength(earth.HYDERABAD.lat, earth.declination(356));
  assert.ok(june > 12.8 && june < 13.3, `June ${june}`);
  assert.ok(dec > 10.8 && dec < 11.3, `December ${dec}`);
  assert.ok(Math.abs(earth.declination(172) - 23.44) < 0.1);
  for (const tl of [earth.FREEDOM_EVENTS, earth.TELANGANA_EVENTS]) {
    for (let i = 1; i < tl.length; i++) assert.ok(tl[i].year > tl[i - 1].year, `${tl[i].title} is in order`);
  }
});
