import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { DeployScene } from './scenes/DeployScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  transparent: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  scene: [PreloadScene, DeployScene],
};
