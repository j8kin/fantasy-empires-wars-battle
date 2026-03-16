import Phaser from 'phaser';
import { WORLD_PX, DEFAULT_ZONES } from '../config/worldConfig';
import { AssetKeys } from '../constants';

export class DeployScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DeployScene' });
  }

  create(): void {
    // Tile CelticBackground across the full 4000 × 4000 px world
    this.add
      .tileSprite(0, 0, WORLD_PX.width, WORLD_PX.height, AssetKeys.CELTIC_BACKGROUND)
      .setOrigin(0, 0);

    // Step 1 placeholder: subtle tinted fills to make zone boundaries visible.
    // Will be replaced in Step 2 by CSS filter darkening on React zone frames
    // once BattleContext (playerSide) is connected to BattleLayout.
    this.drawZoneOverlays();

    this.fitCameraToWorld();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private drawZoneOverlays(): void {
    const { attacker, neutral } = DEFAULT_ZONES;
    const zones = [
      { h: WORLD_PX.height * attacker,                 color: 0x4a80ff, alpha: 0.18 },
      { h: WORLD_PX.height * neutral,                  color: 0xffcc00, alpha: 0.15 },
      { h: WORLD_PX.height * (1 - attacker - neutral), color: 0xff4a4a, alpha: 0.18 },
    ];

    const gfx = this.add.graphics();
    let y = 0;
    for (const { h, color, alpha } of zones) {
      gfx.fillStyle(color, alpha);
      gfx.fillRect(0, y, WORLD_PX.width, h);
      y += h;
    }
  }

  /** Scale the camera so the full 4000 × 4000 px world fits in the canvas. */
  private fitCameraToWorld(): void {
    const { width, height } = this.scale;
    const zoom = Math.min(width / WORLD_PX.width, height / WORLD_PX.height);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(WORLD_PX.width / 2, WORLD_PX.height / 2);
  }
}
