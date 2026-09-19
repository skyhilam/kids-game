import Phaser from 'phaser';
import { DeliveryScene } from './DeliveryScene';
import { MazeScene } from './MazeScene';
import type { BoardModel } from './models';

export function startBoardGame(parent: HTMLElement, readModel: () => BoardModel): Phaser.Game {
  const snapshot = readModel();
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.CANVAS,
    parent,
    width: snapshot.width,
    height: snapshot.height,
    backgroundColor: snapshot.kind === 'delivery' ? '#eaf0df' : snapshot.kind === 'maze' && snapshot.theme === 'tooth' ? '#e7f2ee' : '#e4edd4',
    banner: false,
    audio: { noAudio: true },
    input: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: snapshot.width,
      height: snapshot.height,
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
      },
    },
  };
  return new Phaser.Game(config);
}
