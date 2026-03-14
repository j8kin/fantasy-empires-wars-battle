import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Load game assets here
    // this.load.image('key', 'path/to/asset.png')
  }

  create() {
    this.scene.start('GameScene')
  }
}
