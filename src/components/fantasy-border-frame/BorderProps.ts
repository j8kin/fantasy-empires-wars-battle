/**
 * Top Left position of the window/dialog/popup
 */
export interface ScreenPosition {
  x: number;
  y: number;
}
/**
 * Width and height of the window/dialog/popup
 */
export interface FrameSize {
  width: number;
  height: number;
}

export interface BorderProps {
  side: 'left' | 'right' | 'top' | 'bottom';
  tileDimensions: FrameSize;
  length: number;
  zIndex: number;
}

// 50*180 since the base tile is vertical
export const defaultTileDimensions: FrameSize = {
  width: 50,
  height: 180,
};

