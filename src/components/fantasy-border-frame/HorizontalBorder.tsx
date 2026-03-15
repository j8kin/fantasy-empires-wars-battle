import React from 'react';

import type { BorderProps } from './BorderProps';

import CelticPatternVertical from '../../../sprites/border/CelticPatternVertical.png';

const HorizontalBorder: React.FC<BorderProps> = ({ side, tileDimensions, length, zIndex }) => {
  const amount = Math.ceil(length / tileDimensions.height);
  const images = Array.from({ length: amount }).map((_, index) => (
    <img
      key={`${side}-${index}`}
      src={CelticPatternVertical}
      alt={`${side.charAt(0).toUpperCase() + side.slice(1)} Border`}
      style={{
        position: 'absolute',
        [side]: side === 'top' ? 0 : tileDimensions.width - tileDimensions.height,

        // Place tiles along X-axis
        left: index * tileDimensions.height,

        // Swap dimensions after rotation
        width: tileDimensions.width,
        height: tileDimensions.height,

        transform: 'rotate(270deg)',
        transformOrigin: 'top right',
      }}
    />
  ));

  const placeHolderStyle: React.CSSProperties = {
    position: 'absolute',
    [side]: 0,
    left: 0,
    width: length,
    height: Math.min(tileDimensions.width, tileDimensions.height),
    display: 'flex',
    flexDirection: 'column',
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: zIndex,
  };

  return <div style={placeHolderStyle}>{images}</div>;
};

export default HorizontalBorder;
