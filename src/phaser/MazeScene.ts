import Phaser from 'phaser';
import type { SpriteName } from '../art/sprites';
import { carPose } from '../game/motion';
import { picnicCollect } from '../picnic/board';
import { SHOP_ART, shopArtOrigin } from '../picnic/art';
import { EventBus } from './EventBus';
import { drawMazeRoads, drawMazeTrails, drawPicnicScenery, drawToothScenery } from './draw';
import type { BoardModel, MazeBoardModel } from './models';
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

const PICNIC_SPRITES = ['home', 'shop', 'burger', 'picnic', 'picnic-place', 'car-top', 'sun', 'tree', 'flower'] as const satisfies readonly SpriteName[];
const TOOTH_SPRITES = ['tooth', 'toothbrush', 'bug-coral', 'bug-purple', 'kid', 'kid-cheer'] as const satisfies readonly SpriteName[];

function facingLeft(angle: number): boolean {
  return Math.cos(angle * Math.PI / 180) < -0.1;
}

function bugName(index: number): SpriteName {
  return index % 2 ? 'bug-purple' : 'bug-coral';
}

export class MazeScene extends Phaser.Scene {
  constructor() {
    super('MazeScene');
  }

  preload(): void {
    const model = this.read();
    preloadBoardAtlases(this, model.theme === 'tooth' ? TOOTH_SPRITES : PICNIC_SPRITES);
  }

  create(): void {
    const model = this.read();
    registerAtlasFrames(this, model.theme === 'tooth' ? TOOTH_SPRITES : PICNIC_SPRITES);
    this.cameras.main.setBackgroundColor(model.theme === 'tooth' ? '#e7f2ee' : '#e4edd4');
    this.scenery = this.add.graphics().setDepth(0);
    this.roads = this.add.graphics().setDepth(1);
    this.trails = this.add.graphics().setDepth(2);
    this.marks = this.add.graphics().setDepth(3);
    this.parts = this.add.container(0, 0).setDepth(4);
    this.player = this.add.sprite(0, 0, atlasKey(model.theme === 'tooth' ? 'kid' : 'car-top'), model.theme === 'tooth' ? 'kid' : 'car-top').setDepth(5);
    this.cargo = this.add.sprite(0, 0, atlasKey('burger'), 'burger').setDepth(6);
    this.pickup = this.add.text(0, 0, '已購得漢堡  ✓', {
      fontFamily: BOARD_FONT, fontSize: '14px', color: '#304b43', backgroundColor: '#fffdf8',
      padding: { x: 12, y: 8 },
    }).setOrigin(0.5, 1).setDepth(7).setVisible(false);
    this.drawBackdrop(model);
    EventBus.emit('current-scene-ready', this);
  }

  update(time: number): void {
    const model = this.read();
    if (model.width !== this.scale.width || model.height !== this.scale.height) {
      this.scale.resize(model.width, model.height);
      this.drawBackdrop(model);
    }
    drawMazeRoads(this.roads, model.graph, model.theme === 'tooth' ? { ...model.roads, center: '#c9ddd5' } : model.roads);
    drawMazeTrails(this.trails, model.graph, model.state, model.inFlight);
    this.syncLandmarks(model, time);
    this.syncPlayer(model, time);
    this.syncPickup(model);
    this.publish(model);
  }

  private scenery!: Phaser.GameObjects.Graphics;
  private roads!: Phaser.GameObjects.Graphics;
  private trails!: Phaser.GameObjects.Graphics;
  private marks!: Phaser.GameObjects.Graphics;
  private parts!: Phaser.GameObjects.Container;
  private player!: Phaser.GameObjects.Sprite;
  private cargo!: Phaser.GameObjects.Sprite;
  private pickup!: Phaser.GameObjects.Text;
  private art = new Map<string, Phaser.GameObjects.Sprite>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private seenCollect = false;
  private pickupUntil = 0;

  private read(): MazeBoardModel {
    return this.registry.get('readModel')() as MazeBoardModel;
  }

  private drawBackdrop(model: MazeBoardModel): void {
    if (model.theme === 'tooth') drawToothScenery(this.scenery, model.width, model.height);
    else drawPicnicScenery(this.scenery, model.width, model.height);
  }

  private sprite(id: string, name: SpriteName, x: number, y: number, width: number, height: number, origin = { x: 0, y: 0 }): Phaser.GameObjects.Sprite {
    let sprite = this.art.get(id);
    if (!sprite) {
      sprite = addBoardSprite(this, name, x, y, width, height, origin);
      this.parts.add(sprite);
      this.art.set(id, sprite);
    } else {
      sprite.setTexture(atlasKey(name), name);
      sprite.setPosition(x, y);
      sprite.setDisplaySize(width, height);
      sprite.setOrigin(origin.x, origin.y);
    }
    sprite.setVisible(true);
    return sprite;
  }

  private label(id: string, x: number, y: number, text: string, fill: string, stroke: string, color: string): void {
    let item = this.labels.get(id);
    if (!item) {
      item = this.add.text(x, y, text, {
        fontFamily: BOARD_FONT, fontSize: '12px', color, fontStyle: 'bold',
        backgroundColor: fill, padding: { x: 10, y: 5 },
      }).setOrigin(0.5);
      item.setStroke(stroke, 1);
      this.parts.add(item);
      this.labels.set(id, item);
    } else {
      item.setPosition(x, y).setText(text).setColor(color).setBackgroundColor(fill);
    }
    item.setVisible(true);
  }

  private hideUnused(prefix: string, keep: Set<string>): void {
    for (const [id, sprite] of this.art) {
      if (id.startsWith(prefix) && !keep.has(id)) sprite.setVisible(false);
    }
    for (const [id, item] of this.labels) {
      if (id.startsWith(prefix) && !keep.has(id)) item.setVisible(false);
    }
  }

  private syncLandmarks(model: MazeBoardModel, time: number): void {
    this.marks.clear();
    const keep = new Set<string>();
    if (model.theme === 'picnic') this.picnicMarks(model, keep);
    else this.toothMarks(model, time, keep);
    this.hideUnused('', keep);
  }

  private picnicMarks(model: MazeBoardModel, keep: Set<string>): void {
    const { graph, state } = model;
    const start = graph.nodes[graph.start];
    const shopId = picnicCollect(graph);
    const shop = graph.nodes[shopId];
    const park = graph.nodes[graph.goal];
    const shopArt = shopArtOrigin(shop);
    const wiggle = (id: string, name: SpriteName, x: number, y: number, width: number, height: number) => {
      keep.add(id);
      this.sprite(id, name, x, y, width, height);
    };
    wiggle('sun', 'sun', 726 / 840 * model.width, 33 / 660 * model.height, 80, 80);
    wiggle('tree-a', 'tree', 20 / 840 * model.width, 188 / 660 * model.height, 76, 97);
    wiggle('tree-b', 'tree', 748 / 840 * model.width, 309 / 660 * model.height, 80, 108);
    wiggle('tree-c', 'tree', 21 / 840 * model.width, 544 / 660 * model.height, 66, 88);
    wiggle('flower-a', 'flower', 265 / 840 * model.width, 238 / 660 * model.height, 29, 35);
    wiggle('flower-b', 'flower', 330 / 840 * model.width, 574 / 660 * model.height, 30, 36);
    wiggle('flower-c', 'flower', 533 / 840 * model.width, 437 / 660 * model.height, 28, 34);
    wiggle('home', 'home', start[0] - 58, start[1] - 130, 116, 106);
    this.label('start-title', start[0] + 61, start[1] - 29, graph.titles[graph.start], '#fff5e7', '#efc9b1', '#c27c5a');
    keep.add('start-title');
    this.marks.lineStyle(4, rgb('#de785c'), 1);
    this.marks.lineBetween(start[0] + 30, start[1] - 10, start[0] + 14, start[1] + 1);
    this.marks.lineBetween(start[0] + 17, start[1] - 13, start[0] + 14, start[1] + 1);
    this.marks.lineBetween(start[0] + 14, start[1] + 1, start[0] + 28, start[1] + 2);
    wiggle('shop', 'shop', shopArt[0], shopArt[1], SHOP_ART.width, SHOP_ART.height);
    this.label('shop-title', shop[0], shop[1] - 30, graph.titles[shopId], '#fff8e6', '#dcd2aa', '#9b7751');
    keep.add('shop-title');
    this.marks.fillStyle(rgb(state.collected ? '#e6efda' : '#fbebc6'), 1);
    this.marks.lineStyle(2, rgb(state.collected ? '#8eac70' : '#d9b571'), 1);
    this.marks.fillCircle(shop[0], shop[1], 18);
    this.marks.strokeCircle(shop[0], shop[1], 18);
    if (state.collected) {
      this.marks.lineStyle(3, rgb('#6a9257'), 1);
      this.marks.lineBetween(shop[0] - 8, shop[1], shop[0] - 3, shop[1] + 5);
      this.marks.lineBetween(shop[0] - 3, shop[1] + 5, shop[0] + 9, shop[1] - 7);
    } else {
      wiggle('shop-burger', 'burger', shop[0] - 14, shop[1] - 13, 28, 26);
    }
    const picnicX = Math.min(park[0] - 95, model.width - 210);
    wiggle('picnic', state.won ? 'picnic' : 'picnic-place', picnicX, park[1] + 9, 200, 104);
    this.marks.fillStyle(rgb('#dcebea'), 1);
    this.marks.lineStyle(2, rgb('#79a6ac'), 1);
    this.marks.fillCircle(park[0], park[1], 19);
    this.marks.strokeCircle(park[0], park[1], 19);
    this.marks.lineStyle(3.5, rgb('#609299'), 1);
    this.marks.lineBetween(park[0] - 9, park[1], park[0] + 9, park[1]);
    this.marks.lineBetween(park[0] + 2, park[1] - 7, park[0] + 9, park[1]);
    this.marks.lineBetween(park[0] + 9, park[1], park[0] + 2, park[1] + 7);
    this.label('park-title', Math.min(park[0] + 56, model.width - 31), park[1] - 18, graph.titles[graph.goal], '#eef6ed', '#aec9bc', '#658d7e');
    keep.add('park-title');
    this.marks.lineStyle(5, rgb('#b9ac85'), 1);
    for (const id of graph.deadends) {
      const [x, y] = graph.nodes[id];
      this.marks.lineBetween(x - 18, y - 16, x - 18, y + 16);
      this.marks.lineStyle(4, rgb('#d4c7a0'), 1);
      this.marks.lineBetween(x - 24, y - 10, x - 12, y - 10);
      this.marks.lineBetween(x - 24, y + 9, x - 12, y + 9);
      this.marks.lineStyle(5, rgb('#b9ac85'), 1);
    }
  }

  private toothMarks(model: MazeBoardModel, time: number, keep: Set<string>): void {
    const { graph, state, inFlight } = model;
    const start = graph.nodes[graph.start];
    const goal = graph.nodes[graph.goal];
    this.marks.fillStyle(rgb('#bdddd2'), 1);
    this.marks.fillEllipse(start[0], start[1] + 8, 72, 24);
    this.label('start-title', start[0] + 56, start[1] + 6, graph.titles[graph.start], '#e8f4ff', '#b7cde0', '#4d7a9a');
    keep.add('start-title');
    this.marks.fillStyle(rgb('#cde3ce'), 1);
    this.marks.fillEllipse(goal[0], goal[1] + 8, 76, 24);
    const glow = model.reduceMotion ? 1 : 0.65 + Math.sin(time / 480) * 0.35;
    keep.add('tooth');
    this.sprite('tooth', 'tooth', goal[0] - 51, goal[1] - 125, 102, 96).setAlpha(0.75 + glow * 0.25);
    this.label('goal-title', Math.min(goal[0] + 52, model.width - 31), goal[1] + 6, graph.titles[graph.goal], '#eef6ed', '#aec9bc', '#658d7e');
    keep.add('goal-title');
    keep.add('brush-a');
    keep.add('brush-b');
    this.sprite('brush-a', 'toothbrush', 38 / 840 * model.width, 39 / 660 * model.height, 36, 72).setAlpha(0.72);
    this.sprite('brush-b', 'toothbrush', 762 / 840 * model.width, 530 / 660 * model.height, 32, 68).setAlpha(0.65);
    const links = inFlight ? [] : (graph.adj[state.node] ?? []).filter((link) => !state.used.has(link.edge.id));
    const shown = new Set(links.map((link) => link.to));
    graph.hazards.forEach((id, index) => {
      if (shown.has(id)) return;
      const [x, y] = graph.nodes[id];
      this.marks.fillStyle(rgb('#b7858d'), 0.18);
      this.marks.fillEllipse(x, y + 17, 62, 20);
      const key = `bug-${id}`;
      keep.add(key);
      const bug = this.sprite(key, bugName(index), x - 42, y - 55, 84, 84);
      bug.setAngle(model.reduceMotion ? 0 : Math.sin(time / 420 + index) * 5);
    });
  }

  private syncPlayer(model: MazeBoardModel, time: number): void {
    const pose = carPose(model.graph, model.state.node, model.facing, model.inFlight);
    const action = currentAction(!!model.inFlight, model.state.won);
    if (model.theme === 'tooth') {
      const name: SpriteName = model.state.won ? 'kid-cheer' : 'kid';
      syncBoardSprite(this, this.player, name, action, { reduceMotion: model.reduceMotion, origin: { x: 0.5, y: 0.83 } });
      this.player.setDisplaySize(86, 110);
      this.player.setFlipX(facingLeft(pose.angle));
      const bob = !model.reduceMotion && model.inFlight ? Math.sin(time / 80) * 5 : 0;
      this.player.setPosition(pose.x, pose.y + bob);
      this.player.setAngle(model.reduceMotion || !model.inFlight ? 0 : Math.sin(time / 80) * 2);
      this.cargo.setVisible(false);
      this.marks.fillStyle(rgb('#446f5b'), 0.15);
      this.marks.fillEllipse(pose.x, pose.y + 15, 50, 16);
      return;
    }
    syncBoardSprite(this, this.player, 'car-top', action, { reduceMotion: model.reduceMotion, origin: { x: 0.5, y: 0.5 } });
    this.player.setDisplaySize(100, 66);
    this.player.setFlipX(false);
    this.player.setPosition(pose.x, pose.y);
    this.player.setAngle(pose.angle);
    this.cargo.setVisible(model.state.collected);
    if (model.state.collected) {
      this.cargo.setTexture(atlasKey('burger'), 'burger');
      this.cargo.setDisplaySize(29, 29);
      this.cargo.setPosition(pose.x - 29, pose.y - 28);
      this.cargo.setAngle(pose.angle);
    }
  }

  private syncPickup(model: MazeBoardModel): void {
    if (model.theme !== 'picnic') {
      this.pickup.setVisible(false);
      return;
    }
    if (model.state.collected && !this.seenCollect) {
      this.pickupUntil = this.time.now + 2300;
      const shop = model.graph.nodes[picnicCollect(model.graph)];
      this.pickup.setPosition(shop[0], shop[1] - 43).setVisible(true);
    }
    this.seenCollect = model.state.collected;
    if (this.time.now > this.pickupUntil) this.pickup.setVisible(false);
  }

  private publish(model: MazeBoardModel): void {
    const host = this.game.canvas.parentElement;
    if (!host) return;
    host.dataset.phaserReady = 'true';
    const name = model.theme === 'tooth' ? (model.state.won ? 'kid-cheer' : 'kid') : 'car-top';
    host.dataset.playerSprite = name;
    const animated = this.player.anims.isPlaying;
    if (animated) host.dataset.animated = 'true';
    else delete host.dataset.animated;
    const frame = this.player.anims.currentFrame;
    if (animated && frame) host.dataset.frame = String(frame.index);
    else delete host.dataset.frame;
    host.dataset.action = currentAction(!!model.inFlight, model.state.won);
  }
}

export type { BoardModel };
