import Phaser from 'phaser'

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    // Placeholder grid — replace with actual map/tile logic
    this.add
      .text(width / 2, height / 2, 'Strategy Game\nGame Scene', {
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)

    // Launch HUD on top
    this.scene.launch('UIScene')
  }

  update() {
    // Game loop logic goes here
  }
}
