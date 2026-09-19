import Phaser from 'phaser';
import { DeliveryScene } from './DeliveryScene';
import { MazeScene } from './MazeScene';
import type { BoardModel } from './models';
import { boardBacking } from './display';

export function startBoardGame(parent: HTMLElement, readModel: () => BoardModel): Phaser.Game {
  const snapshot = readModel();
  const backing = boardBacking(parent, snapshot);
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.CANVAS,
    parent,
    width: backing.width,
    height: backing.height,
    backgroundColor: snapshot.kind === 'delivery' ? '#eaf0df' : snapshot.kind === 'maze' && snapshot.theme === 'tooth' ? '#e7f2ee' : '#e4edd4',
    banner: false,
    audio: { noAudio: true },
    input: false,
    scale: {
      mode: Phaser.Scale.NONE,
      width: backing.width,
      height: backing.height,
    },
    render: {
      antialias: true,
      preserveDrawingBuffer: true,
    },
    scene: snapshot.kind === 'delivery' ? DeliveryScene : MazeScene,
    callbacks: {
      preBoot(game) {
        game.registry.set('readModel', readModel);
      },
      postBoot(game) {
        game.canvas.style.pointerEvents = 'none';
        game.canvas.setAttribute('aria-hidden', 'true');
        const ctx = game.canvas.getContext('2d');
        if (ctx) ctx.imageSmoothingQuality = 'high';
      },
    },
  };
  return new Phaser.Game(config);
}
