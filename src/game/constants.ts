export const SceneKeys = {
  PRELOAD:   'PreloadScene',
  DEPLOY:    'DeployScene',
  BATTLE:    'BattleScene',
  BATTLE_UI: 'BattleUIScene',
} as const;

export const AssetKeys = {
  CELTIC_BACKGROUND: 'celtic-background',
} as const;

export const EventNames = {
  LOAD_PROGRESS:    'load-progress',
  PRELOAD_COMPLETE: 'preload-complete',
  BATTLE_COMPLETE:  'battle-complete',
} as const;
