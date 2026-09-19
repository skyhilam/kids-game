import Phaser from 'phaser';
import type { SpriteName } from '../art/sprites';
import { roadKey } from '../game/graph';
import { EventBus } from './EventBus';
import { drawDeliveryScenery } from './draw';
import type { DeliveryBoardModel } from './models';
import {
  BOARD_FONT,
  addBoardSprite,
  atlasKey,
  currentAction,
  preloadBoardAtlases,
  registerAtlasFrames,
  rgb,
  syncBoardSprite,
} from './textures';

const SPRITES = ['tree', 'flower', 'sun', 'home', 'parcel', 'truck-top'] as const satisfies readonly SpriteName[];
const TREE_SPOTS = [[0.29, 0.34], [0.79, 0.69], [0.86, 0.85], [0.55, 0.12]] as const;

export class DeliveryScene extends Phaser.Scene {
  constructor() {
    super('DeliveryScene');
  }

  preload(): void {
    preloadBoardAtlases(this, SPRITES);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#eaf0df');
    this.scenery = this.add.graphics().setDepth(0);
    this.roads = this.add.graphics().setDepth(1);
    this.parts = this.add.container(0, 0).setDepth(2);
    this.truck = this.add.sprite(0, 0, atlasKey('truck-top'), 'truck-top').setDepth(3);
    this.art = new Map();
    this.labels = new Map();
    this.drawBackdrop(this.read());
    EventBus.emit('current-scene-ready', this);
  }

  update(): void {
    const model = this.read();
    if (model.width !== this.scale.width || model.height !== this.scale.height) {
      this.scale.resize(model.width, model.height);
      this.drawBackdrop(model);
    }
    this.drawRoads(model);
    this.syncLandmarks(model);
    this.syncTruck(model);
    this.publish(model);
  }

  private scenery!: Phaser.GameObjects.Graphics;
  private roads!: Phaser.GameObjects.Graphics;
  private parts!: Phaser.GameObjects.Container;
  private truck!: Phaser.GameObjects.Sprite;
  private art!: Map<string, Phaser.GameObjects.Sprite>;
  private labels!: Map<string, Phaser.GameObjects.Text>;

  private read(): DeliveryBoardModel {
    return this.registry.get('readModel')() as DeliveryBoardModel;
  }

  private drawBackdrop(model: DeliveryBoardModel): void {
    drawDeliveryScenery(this.scenery, model.width, model.height);
    TREE_SPOTS.forEach(([x, y], i) => {
      this.sprite(`tree-${i}`, 'tree', model.width * x - 33, model.height * y - 48, 66, 85);
    });
    this.sprite('flower-a', 'flower', model.width * 0.56, model.height * 0.91, 46, 40);
    this.sprite('flower-b', 'flower', model.width * 0.3, model.height * 0.59, 38, 35);
    this.sprite('sun', 'sun', model.width - 76, 20, 47, 47);
  }

  private sprite(id: string, name: SpriteName, x: number, y: number, width: number, height: number): Phaser.GameObjects.Sprite {
    let sprite = this.art.get(id);
    if (!sprite) {
      sprite = addBoardSprite(this, name, x, y, width, height);
      this.parts.add(sprite);
      this.art.set(id, sprite);
    } else {
      sprite.setPosition(x, y).setDisplaySize(width, height);
    }
    sprite.setVisible(true);
    return sprite;
  }

  private label(id: string, x: number, y: number, text: string, color: string, fill: string): Phaser.GameObjects.Text {
    let item = this.labels.get(id);
    if (!item) {
      item = this.add.text(x, y, text, {
        fontFamily: BOARD_FONT, fontSize: '17px', color, fontStyle: 'bold',
        backgroundColor: fill, padding: { x: 12, y: 6 },
      }).setOrigin(0.5);
      this.parts.add(item);
      this.labels.set(id, item);
    } else {
      item.setPosition(x, y).setText(text).setColor(color).setBackgroundColor(fill);
    }
    return item;
  }

  private drawRoads(model: DeliveryBoardModel): void {
    const { mission, state, hint, position } = model;
    this.roads.clear();
    this.roads.lineStyle(48, rgb('#ced8bf'), 1);
    for (const [a, b] of mission.edges) {
      const pa = mission.nodes[a];
      const pb = mission.nodes[b];
      this.roads.lineBetween(pa[0], pa[1], pb[0], pb[1]);
    }
    this.roads.lineStyle(39, rgb('#fffdf5'), 1);
    for (const [a, b] of mission.edges) {
      const pa = mission.nodes[a];
      const pb = mission.nodes[b];
      this.roads.lineBetween(pa[0], pa[1], pb[0], pb[1]);
    }
    this.roads.lineStyle(12, rgb('#dd9161'), 1);
    for (const [a, b] of mission.edges) {
      if (!state.used.has(roadKey(a, b))) continue;
      const pa = mission.nodes[a];
      const pb = mission.nodes[b];
      this.roads.lineBetween(pa[0], pa[1], pb[0], pb[1]);
    }
    const from = mission.nodes[state.node];
    if (from[0] !== position[0] || from[1] !== position[1]) {
      this.roads.lineBetween(from[0], from[1], position[0], position[1]);
    }
    if (hint) {
      const to = mission.nodes[hint];
      this.roads.lineStyle(9, rgb('#549785'), 1);
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      for (let d = 0; d < len; d += 19) {
        const end = Math.min(len, d + 2);
        this.roads.lineBetween(from[0] + ux * d, from[1] + uy * d, from[0] + ux * end, from[1] + uy * end);
      }
    }
    this.roads.fillStyle(rgb('#d6dcc8'), 1);
    for (const point of Object.values(mission.nodes)) this.roads.fillCircle(point[0], point[1], 5);
  }

  private syncLandmarks(model: DeliveryBoardModel): void {
    const { mission, state, houses } = model;
    const start = mission.nodes.start;
    const finish = mission.nodes.finish;
    this.roads.lineStyle(8, rgb('#d96f53'), 1);
    this.roads.lineBetween(start[0] - 29, start[1], start[0] + 27, start[1]);
    this.roads.lineBetween(start[0] + 13, start[1] - 13, start[0] + 28, start[1]);
    this.roads.lineBetween(start[0] + 28, start[1], start[0] + 13, start[1] + 13);
    this.label('start', start[0], start[1] - 72, '紅色起點', '#ba5944', '#fff8ee');
    this.roads.fillStyle(rgb('#e0eff3'), 1);
    this.roads.lineStyle(2, rgb('#68a6bc'), 1);
    this.roads.fillCircle(finish[0], finish[1], 26);
    this.roads.strokeCircle(finish[0], finish[1], 26);
    this.roads.lineStyle(6, rgb('#4e91ae'), 1);
    this.roads.lineBetween(finish[0] - 13, finish[1], finish[0] + 13, finish[1]);
    this.roads.lineBetween(finish[0] + 2, finish[1] - 10, finish[0] + 13, finish[1]);
    this.roads.lineBetween(finish[0] + 13, finish[1], finish[0] + 2, finish[1] + 10);
    this.label('finish', finish[0], finish[1] - 50, '藍色終點', '#477e96', '#f5fcfc');
    mission.stops.forEach((stop, index) => {
      const [x, y] = mission.nodes[stop.node];
      const house = houses[index]!;
      this.sprite(`house-${index}`, 'home', x - 48, y + house.artY, 96, 87);
      const done = index < state.delivered;
      const current = index === state.delivered;
      this.roads.fillStyle(rgb(done ? '#608d72' : '#fffdf4'), 1);
      this.roads.lineStyle(3, rgb(current ? '#d8944f' : '#8ca57e'), 1);
      this.roads.fillCircle(x, y, 23);
      this.roads.strokeCircle(x, y, 23);
      this.label(`num-${index}`, x, y, String(index + 1), done ? '#fffdf4' : '#557348', 'transparent');
      const sticker = this.sprite(`parcel-${index}`, 'parcel', x + 2, y + house.stickerY - 21, 42, 42);
      sticker.setVisible(done);
    });
  }

  private syncTruck(model: DeliveryBoardModel): void {
    const action = currentAction(model.mode === 'trace' && model.enabled, model.state.won);
    syncBoardSprite(this, this.truck, 'truck-top', action, { reduceMotion: model.reduceMotion, origin: { x: 0.5, y: 0.5 } });
    this.truck.setDisplaySize(80, 58);
    this.truck.setPosition(model.position[0], model.position[1]);
    this.truck.setAngle(model.angle);
    if (model.mode === 'trace' && model.enabled) {
      this.roads.lineStyle(2, rgb('#568fa8'), 1);
      this.roads.fillStyle(rgb('#c1dce8'), 0.2);
      this.roads.fillCircle(model.position[0], model.position[1], 35);
      this.roads.strokeCircle(model.position[0], model.position[1], 35);
    }
  }

  private publish(model: DeliveryBoardModel): void {
    const host = this.game.canvas.parentElement;
    if (!host) return;
    host.dataset.phaserReady = 'true';
    host.dataset.playerSprite = 'truck-top';
    host.dataset.action = currentAction(model.mode === 'trace' && model.enabled, model.state.won);
    host.dataset.node = model.state.node;
  }
}
