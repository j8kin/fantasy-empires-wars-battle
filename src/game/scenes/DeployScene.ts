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

    this.drawZoneOverlays();
    this.addZoneLabels();
    this.fitCameraToWorld();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private drawZoneOverlays(): void {
    const { attacker, neutral } = DEFAULT_ZONES;
    const zones = [
      { h: WORLD_PX.height * attacker,                 color: 0x4a80ff, alpha: 0.18, yInset: 1, hInset: 1 },
      { h: WORLD_PX.height * neutral,                  color: 0xffcc00, alpha: 0.15, yInset: 0, hInset: 0 },
      { h: WORLD_PX.height * (1 - attacker - neutral), color: 0xff4a4a, alpha: 0.18, yInset: 0, hInset: 1 },
    ];

    const gfx = this.add.graphics();
    gfx.lineStyle(3, 0xffffff, 0.5);

    let y = 0;
    for (const { h, color, alpha, yInset, hInset } of zones) {
      gfx.fillStyle(color, alpha);
      gfx.fillRect(0, y, WORLD_PX.width, h);
      gfx.strokeRect(1, y + yInset, WORLD_PX.width - 2, h - hInset);
      y += h;
    }
  }

  /**
   * Labels are rendered in screen-space (setScrollFactor(0)) so they remain
   * legible regardless of camera zoom. Vertical positions mirror zone proportions.
   */
  private addZoneLabels(): void {
    const { width: canvasW, height: canvasH } = this.scale;
    const { attacker, neutral } = DEFAULT_ZONES;
    const defender = 1 - attacker - neutral;

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#00000066',
      padding: { x: 12, y: 6 },
    };

    const cx = canvasW / 2;
    const entries: Array<[string, number]> = [
      ['ATTACKER ZONE', canvasH * (attacker / 2)],
      ['NEUTRAL ZONE',  canvasH * (attacker + neutral / 2)],
      ['DEFENDER ZONE', canvasH * (attacker + neutral + defender / 2)],
    ];

    for (const [label, y] of entries) {
      this.add.text(cx, y, label, style).setOrigin(0.5).setScrollFactor(0);
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
