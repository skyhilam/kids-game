import type { SheetSettings } from '../studio/animation';

/** Board characters switch among these Phaser animations. */
export type PlayerAction = 'idle' | 'drive' | 'cheer';

export function playerAction(state: { moving: boolean; won: boolean }): PlayerAction {
  if (state.won) return 'cheer';
  if (state.moving) return 'drive';
  return 'idle';
}

/**
 * Studio motion the sheet was authored for.
 * `custom` loops in every state until named clips exist.
 */
export function motionAction(motion: SheetSettings['motion']): PlayerAction | 'always' {
  if (motion === 'drive' || motion === 'run' || motion === 'walk') return 'drive';
  if (motion === 'cheer') return 'cheer';
  if (motion === 'custom') return 'always';
  return 'idle';
}

export function shouldPlayMotion(
  motion: SheetSettings['motion'] | undefined,
  action: PlayerAction,
): boolean {
  if (!motion) return true;
  const target = motionAction(motion);
  return target === 'always' || target === action;
}
