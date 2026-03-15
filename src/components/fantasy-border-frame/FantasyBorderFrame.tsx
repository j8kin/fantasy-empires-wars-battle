import React from 'react';
import './css/FantasyBorderFrame.css';

import CornerBorder from './CornerBorder';
import HorizontalBorder from './HorizontalBorder';
import VerticalBorder from './VerticalBorder';
import  {defaultTileDimensions} from "./BorderProps.ts";
import type {FrameSize, ScreenPosition} from "./BorderProps.ts";


export interface FantasyBorderFrameProps {
  screenPosition: ScreenPosition;
  frameSize: FrameSize;
  children: React.ReactNode;
  primaryButton?: React.ReactElement;
  secondaryButton?: React.ReactElement;
  tileDimensions?: FrameSize;
  zIndex?: number;
  accessible?: boolean;
  flexibleSizing?: boolean;
}

const cornerSize = (tileDimensions: FrameSize): number => Math.min(tileDimensions.width, tileDimensions.height);

const FantasyBorderFrame: React.FC<FantasyBorderFrameProps> = ({
  screenPosition,
  frameSize,
  children,
  primaryButton,
  secondaryButton,
  tileDimensions = defaultTileDimensions,
  zIndex = 1000,
  accessible = false,
  flexibleSizing = false,
}) => {
  const { x, y } = screenPosition;
  const { width, height } = frameSize;
  return (
    <>
      {/* Backdrop */}
      {!accessible && (
        <div
          className="fantasy-border-frame__backdrop"
          style={{
            zIndex: zIndex - 1,
          }}
        />
      )}
      {/* Dialog */}
      <div
        className="fantasy-border-frame__dialog"
        style={{
          left: x,
          top: y,
          width,
          height,
          zIndex: zIndex,
        }}
      >
        {/* Corner ornaments */}
        <CornerBorder position="top-left" size={cornerSize(tileDimensions)} zIndex={zIndex + 1} />
        <CornerBorder position="top-right" size={cornerSize(tileDimensions)} zIndex={zIndex + 1} />
        <CornerBorder position="bottom-left" size={cornerSize(tileDimensions)} zIndex={zIndex + 1} />
        <CornerBorder position="bottom-right" size={cornerSize(tileDimensions)} zIndex={zIndex + 1} />

        {/* Horizontal border */}
        <HorizontalBorder side="top" tileDimensions={tileDimensions} length={width} zIndex={zIndex} />
        <HorizontalBorder side="bottom" tileDimensions={tileDimensions} length={width} zIndex={zIndex} />

        {/* Vertical border */}
        <VerticalBorder side="left" tileDimensions={tileDimensions} length={height} zIndex={zIndex} />
        <VerticalBorder side="right" tileDimensions={tileDimensions} length={height} zIndex={zIndex} />

        {/* Dialog content area */}
        <div
          className={`fantasy-border-frame__content ${
            !accessible ? 'fantasy-border-frame__content--not-accessible' : ''
          } ${flexibleSizing ? 'fantasy-border-frame__content--flexible' : 'fantasy-border-frame__content--fixed'}`}
          style={{
            left: cornerSize(tileDimensions),
            top: cornerSize(tileDimensions),
            width: width - cornerSize(tileDimensions) * 2,
            height: flexibleSizing ? 'auto' : height - cornerSize(tileDimensions) * 2,
            maxHeight: flexibleSizing ? height - cornerSize(tileDimensions) * 2 : undefined,
            zIndex: zIndex,
          }}
        >
          {children}
        </div>

        {/* Button area on bottom border */}
        {(primaryButton || secondaryButton) && (
          <div
            className="fantasy-border-frame__button-area"
            style={{
              left: cornerSize(tileDimensions),
              width: width - cornerSize(tileDimensions) * 2,
              height: Math.min(Math.min(tileDimensions.height, tileDimensions.width), 60),
              zIndex: zIndex + 2,
            }}
          >
            {primaryButton && <div>{primaryButton}</div>}
            {secondaryButton && <div>{secondaryButton}</div>}
          </div>
        )}
      </div>
    </>
  );
};

export default FantasyBorderFrame;
