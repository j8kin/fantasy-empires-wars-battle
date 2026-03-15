import React from 'react';
import styles from './css/ProgressPopup.module.css';

import PopupWrapper from './PopupWrapper';

import type { PopupProps } from './PopupWrapper';

interface ProgressPopupProps extends PopupProps {
  message: string;
}

const ProgressPopup: React.FC<ProgressPopupProps> = ({ screenPosition, message }) => {
  return (
    <>
      <div className={styles.blockingOverlay} data-testid="progress-popup-overlay" />
      <PopupWrapper screenPosition={screenPosition} dimensions={{ width: 400, height: 200 }} accessible={false}>
        <div className={styles.content} data-testid="progress-popup-content">
          <div className={styles.progressBar} data-testid="progress-popup-bar">
            <div className={styles.progressBarFill} data-testid="progress-popup-fill" />
          </div>
          <div className={styles.message} data-testid="progress-popup-message">
            {message}
          </div>
        </div>
      </PopupWrapper>
    </>
  );
};

export default ProgressPopup;
