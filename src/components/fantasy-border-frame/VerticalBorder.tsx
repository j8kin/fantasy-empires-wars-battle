import React from 'react';

import type {BorderProps} from './BorderProps';

import CelticPatternVertical from '../../../sprites/border/CelticPatternVertical.png';

const VerticalBorder: React.FC<BorderProps> = ({side, tileDimensions, length, zIndex}) => {
    const amount = Math.ceil(length / tileDimensions.height);
    const images = Array.from({length: amount}).map((_, index) => (
        <img
            key={`${side}-${index}`}
            src={CelticPatternVertical}
            alt={`${side.charAt(0).toUpperCase() + side.slice(1)} Border`}
            style={{
                position: 'absolute',

                // Place tiles along X-axis
                top: index * tileDimensions.height,

                // Swap dimensions after rotation
                width: tileDimensions.width,
                height: tileDimensions.height,
            }}
        />
    ));

    const placeHolderStyle: React.CSSProperties = {
        position: 'absolute',
        [side]: 0,
        top: 0,
        height: length,
        width: Math.min(tileDimensions.width, tileDimensions.height),
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: zIndex,
    };

    return <div style={placeHolderStyle}>{images}</div>;
};

export default VerticalBorder;
