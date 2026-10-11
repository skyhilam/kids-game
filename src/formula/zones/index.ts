import { mixSeed } from '../../game/rng';
import { ZONE_CATALOG, ZONE_IDS, type FormulaQuestion, type FormulaTag, type ZoneId } from '../types';
import * as areaPerimeter from './areaPerimeter';
import * as directions from './directions';
import * as factorization from './factorization';
import * as interest from './interest';
import * as percentage from './percentage';
import * as pythagoras from './pythagoras';
import * as units from './units';
import * as volumeEuler from './volumeEuler';

/**
 * Formula Island zone registry, in unlock order.
 * Zone 7 is two ordered sections (volume, then Euler), each with its own tutorial.
 * Hint cards exist only in zones 6–8 and show the formula, never the answer.
 */

export type TutorialStep = { title: string; body: string };

export type ZoneSectionKey = 'main' | 'volume' | 'euler';

export type ZoneSection = {
  key: ZoneSectionKey;
  tutorial: readonly TutorialStep[];
  deal: (seed: number) => FormulaQuestion[];
};

export type ZoneDef = {
  id: ZoneId;
  key: string;
  title: string;
  sections: readonly ZoneSection[];
  hints: boolean;
};

export const HINT_ZONES: readonly ZoneId[] = [6, 7, 8];

export function zoneHasHints(zone: ZoneId): boolean {
  return HINT_ZONES.includes(zone);
}

function single(deal: (seed: number) => FormulaQuestion[], tutorial: readonly TutorialStep[]): ZoneSection[] {
  return [{ key: 'main', tutorial, deal }];
}

const SECTIONS: Record<ZoneId, ZoneSection[]> = {
  1: single(directions.deal, directions.tutorialSteps),
  2: single(units.deal, units.tutorialSteps),
  3: single(areaPerimeter.deal, areaPerimeter.tutorialSteps),
  4: single(percentage.deal, percentage.tutorialSteps),
  5: single(pythagoras.deal, pythagoras.tutorialSteps),
  6: single(factorization.deal, factorization.tutorialSteps),
  7: [
    { key: 'volume', tutorial: volumeEuler.volumeTutorialSteps, deal: volumeEuler.dealVolume },
    { key: 'euler', tutorial: volumeEuler.eulerTutorialSteps, deal: volumeEuler.dealEuler },
  ],
  8: single(interest.deal, interest.tutorialSteps),
};

export const FORMULA_ZONES: readonly ZoneDef[] = ZONE_CATALOG.map((entry) => ({
  id: entry.id,
  key: entry.key,
  title: entry.title,
  sections: SECTIONS[entry.id],
  hints: zoneHasHints(entry.id),
}));

export function zoneDef(zone: ZoneId): ZoneDef {
  const def = FORMULA_ZONES.find((entry) => entry.id === zone);
  if (!def) throw new Error(`Unknown Formula Island zone ${zone}`);
  return def;
}

/** The zone after `zone` in unlock order, or null after zone 8. */
export function nextZoneId(zone: ZoneId): ZoneId | null {
  const index = ZONE_IDS.indexOf(zone);
  return ZONE_IDS[index + 1] ?? null;
}

/**
 * Zone 6 rematch: one fresh question per missed identity, in the order given.
 * The rematch deal uses a salted seed so the numbers differ from the first ask.
 */
export function dealFactorRematch(seed: number, missed: readonly FormulaTag[]): FormulaQuestion[] {
  const fresh = factorization.deal(mixSeed(seed, 6, 1));
  return missed.map((tag) => {
    const question = fresh.find((item) => item.tag === tag);
    if (!question) throw new Error(`No rematch question for ${tag}`);
    return question;
  });
}
