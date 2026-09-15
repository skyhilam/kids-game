import type { GraphLabels } from './graph';
import { mazeLoadBand, STAGE_LABEL } from './stages';
import type { Graph, MoveOk, StallReason } from './types';

export type GuideLine = { main: string; sub: string };

export type SessionCopy = {
  labels: GraphLabels;
  startGuide: (graph: Graph, levelIndex: number) => GuideLine & { announce: string };
  hintGuide: (collected: boolean) => GuideLine;
  arrivalGuide: (graph: Graph, result: MoveOk, used: Set<string>) => GuideLine;
};

export type OverlayCopy = {
  welcome: { eyebrow: string; title: string; body: string };
  stuck: {
    eyebrow: string;
    title: (reason: StallReason) => string;
    body: (reason: StallReason) => string;
    footnote: string;
  };
  win: {
    eyebrow: (level: number) => string;
    title: string;
    body: (allDone: boolean) => string;
    stamps: readonly [string, string, string];
  };
  help: { task: string; controls: string };
  rescue: { title: string; body: string };
};

export function startGuideFrom(
  lines: {
    tutorial: GuideLine & { announce: string };
    standard: { main: string; announce: string };
  },
  graph: Graph,
  levelIndex: number,
): GuideLine & { announce: string } {
  if (graph.tutorial) return { ...lines.tutorial };
  return {
    main: lines.standard.main,
    sub: `第 ${levelIndex + 1} 關 · ${STAGE_LABEL[mazeLoadBand(levelIndex)]}。橙色道路表示已經通行。`,
    announce: lines.standard.announce,
  };
}
