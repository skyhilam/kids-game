import { playerAction, motionAction, shouldPlayMotion } from '../src/game/playerAction';
import { describe, expect, it } from 'vitest';

describe('player action switching', () => {
  it('maps game state to idle, drive, then cheer', () => {
    expect(playerAction({ moving: false, won: false })).toBe('idle');
    expect(playerAction({ moving: true, won: false })).toBe('drive');
    expect(playerAction({ moving: true, won: true })).toBe('cheer');
    expect(playerAction({ moving: false, won: true })).toBe('cheer');
  });

  it('plays studio motions only for the matching Phaser clip', () => {
    expect(motionAction('drive')).toBe('drive');
    expect(motionAction('walk')).toBe('drive');
    expect(motionAction('cheer')).toBe('cheer');
    expect(motionAction('wave')).toBe('idle');
    expect(motionAction('custom')).toBe('always');
    expect(shouldPlayMotion('drive', 'drive')).toBe(true);
    expect(shouldPlayMotion('drive', 'idle')).toBe(false);
    expect(shouldPlayMotion('cheer', 'cheer')).toBe(true);
    expect(shouldPlayMotion('custom', 'idle')).toBe(true);
    expect(shouldPlayMotion(undefined, 'idle')).toBe(true);
  });
});
