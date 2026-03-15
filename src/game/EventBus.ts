import Phaser from 'phaser';

/**
 * Shared event emitter for Phaser → React communication.
 * Phaser scenes emit events here; React components subscribe via useEffect.
 *
 * Events:
 *   'load-progress'   (value: number 0–1)  — asset loading progress
 *   'preload-complete'                      — all assets loaded, game starting
 *   'battle-complete' (result: BattleResult) — battle ended, return to TBS
 */
export const EventBus = new Phaser.Events.EventEmitter();
