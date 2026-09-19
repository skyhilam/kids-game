import Phaser from 'phaser';
import { atlases, sprites, type SpriteName } from '../art/sprites';
import { playerAction, shouldPlayMotion, type PlayerAction } from '../game/playerAction';
import { activeSprites, library } from '../studio/store';
import type { AppliedSprite } from '../studio/store';
import type { ModelName } from '../studio/catalog';
import { fitSize, labelRaster } from './display';

export const BOARD_FONT = 'ui-rounded, "Arial Rounded MT Bold", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif';

export function rgb(hex: string): number {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return parseInt(full, 16);
}

export function atlasKey(name: SpriteName): string {
  return `atlas-${sprites[name].atlas}`;
}

export function appliedKey(name: SpriteName): string {
  return `applied-${name}`;
}

const pending = new Map<string, string>();

export function preloadBoardAtlases(scene: Phaser.Scene, names: readonly SpriteName[]): void {
  const needed = new Set<string>();
  for (const name of names) needed.add(sprites[name].atlas);
  for (const atlas of needed) {
    const key = `atlas-${atlas}`;
    if (!scene.textures.exists(key)) scene.load.image(key, atlases[atlas as keyof typeof atlases].src);
  }
}

export function registerAtlasFrames(scene: Phaser.Scene, names: readonly SpriteName[]): void {
  for (const name of names) {
    const def = sprites[name];
    const key = atlasKey(name);
    if (!scene.textures.exists(key)) continue;
    const texture = scene.textures.get(key);
    if (!texture.has(name)) {
      const [x, y, width, height] = def.frame;
      texture.add(name, 0, x, y, width, height);
    }
  }
}

function sheetConfig(applied: AppliedSprite): Phaser.Types.Textures.SpriteSheetConfig {
  return {
    frameWidth: 128,
    frameHeight: 128,
    endFrame: Math.max(0, applied.frames - 1),
  };
}

export function ensureAppliedSheet(scene: Phaser.Scene, name: SpriteName, applied: AppliedSprite | undefined): boolean {
  const key = appliedKey(name);
  if (!applied || applied.frames < 1) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    if (scene.anims.exists(key)) scene.anims.remove(key);
    pending.delete(key);
    return false;
  }
  if (scene.textures.exists(key) && pending.get(key) === applied.image) return true;
  if (pending.get(key) === applied.image) return scene.textures.exists(key);
  pending.set(key, applied.image);
  const image = new Image();
  image.onload = () => {
    if (pending.get(key) !== applied.image || !scene.sys.isActive()) return;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    if (scene.anims.exists(key)) scene.anims.remove(key);
    scene.textures.addSpriteSheet(key, image, sheetConfig(applied));
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: applied.frames - 1 }),
      frameRate: applied.fps,
      repeat: -1,
    });
  };
  image.src = applied.image;
  return scene.textures.exists(key);
}

export function syncBoardSprite(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  name: SpriteName,
  action: PlayerAction,
  opts: { reduceMotion: boolean; origin?: { x: number; y: number } } = { reduceMotion: false },
): void {
  const applied = activeSprites.value[name as ModelName];
  const ready = ensureAppliedSheet(scene, name, applied);
  if (ready && applied && applied.frames > 1 && scene.textures.exists(appliedKey(name))) {
    const motion = library.value.active[name as ModelName]?.sheet.motion;
    sprite.setTexture(appliedKey(name), 0);
    sprite.setOrigin(opts.origin?.x ?? 0.5, opts.origin?.y ?? 0.5);
    const play = !opts.reduceMotion && !document.hidden && shouldPlayMotion(motion, action);
    if (play) {
      if (sprite.anims.isPaused) sprite.anims.resume();
      else sprite.play(appliedKey(name), true);
    } else if (sprite.anims.isPlaying || sprite.anims.isPaused) {
      sprite.anims.pause();
      sprite.setFrame(0);
    }
    return;
  }
  sprite.anims.stop();
  sprite.setTexture(atlasKey(name), name);
  sprite.setOrigin(opts.origin?.x ?? 0.5, opts.origin?.y ?? 0.5);
}

export function layoutBoardSprite(
  sprite: Phaser.GameObjects.Sprite,
  x: number,
  y: number,
  width: number,
  height: number,
  origin = { x: 0, y: 0 },
): void {
  const fitted = fitSize(sprite.frame.width, sprite.frame.height, width, height);
  sprite.setOrigin(origin.x, origin.y);
  sprite.setDisplaySize(fitted.width, fitted.height);
  if (origin.x === 0 && origin.y === 0) {
    sprite.setPosition(x + (width - fitted.width) / 2, y + (height - fitted.height) / 2);
  } else {
    sprite.setPosition(x, y);
  }
}

export function addBoardSprite(
  scene: Phaser.Scene,
  name: SpriteName,
  x: number,
  y: number,
  width: number,
  height: number,
  origin = { x: 0, y: 0 },
): Phaser.GameObjects.Sprite {
  const sprite = scene.add.sprite(x, y, atlasKey(name), name);
  layoutBoardSprite(sprite, x, y, width, height, origin);
  return sprite;
}

export function currentAction(moving: boolean, won: boolean): PlayerAction {
  return playerAction({ moving, won });
}

export function layoutBoardLabel(
  item: Phaser.GameObjects.Text,
  x: number,
  y: number,
  value: string,
  color: string,
  fontSize: number,
  worldScale: number,
): void {
  const { fontMul, zoom } = labelRaster(worldScale);
  item.setFontFamily(BOARD_FONT);
  item.setFontStyle('bold');
  item.setColor(color);
  item.setText(value);
  item.setFontSize(Math.round(fontSize * fontMul));
  item.setPadding(0, 0);
  item.setScale(zoom);
  item.setPosition(x, y);
}

export function paintLabelChip(
  g: Phaser.GameObjects.Graphics,
  item: Phaser.GameObjects.Text,
  fill: string,
  stroke: string,
): void {
  const padX = 10;
  const padY = 5;
  const width = item.displayWidth + padX * 2;
  const height = item.displayHeight + padY * 2;
  const x = item.x - item.displayWidth * item.originX - padX;
  const y = item.y - item.displayHeight * item.originY - padY;
  const radius = Math.min(12, height / 2);
  g.fillStyle(rgb(fill), 1);
  g.fillRoundedRect(x, y, width, height, radius);
  g.lineStyle(1.25, rgb(stroke), 1);
  g.strokeRoundedRect(x, y, width, height, radius);
}
