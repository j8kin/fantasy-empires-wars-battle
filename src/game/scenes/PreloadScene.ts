import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { SceneKeys, AssetKeys, EventNames } from '../constants';
import celticBgUrl from '../../../sprites/border/CelticBackground.png';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKeys.PRELOAD });
  }

  preload(): void {
    this.load.on('progress', (value: number) => {
      EventBus.emit(EventNames.LOAD_PROGRESS, value);
    });

    this.load.image(AssetKeys.CELTIC_BACKGROUND, celticBgUrl);
  }

  create(): void {
    EventBus.emit(EventNames.PRELOAD_COMPLETE);
    this.scene.start(SceneKeys.DEPLOY);
  }
}
