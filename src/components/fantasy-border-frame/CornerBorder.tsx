import React from 'react';

import CelticPatternCorner from '../../../sprites/border/CelticPatternCorner.png';

interface BorderCornerProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: number;
  zIndex: number;
}

const CornerBorder: React.FC<BorderCornerProps> = ({ position, size, zIndex }) => {
  return (
    <img
      src={CelticPatternCorner}
      alt={`${position} corner ornament`}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        pointerEvents: 'none',
        top: position.includes('top') ? 0 : undefined,
        bottom: position.includes('bottom') ? 0 : undefined,
        left: position.includes('left') ? 0 : undefined,
        right: position.includes('right') ? 0 : undefined,
        zIndex: zIndex,
      }}
    />
  );
};

export default CornerBorder;
