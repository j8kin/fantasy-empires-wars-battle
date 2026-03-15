import React from 'react';
import styles from './css/Popup.module.css';

import PopupWrapper from './PopupWrapper';

import type {PopupProps} from './PopupWrapper';

const ErrorMessagePopup: React.FC<PopupProps> = ({screenPosition, textMessage}) => {
    return (
        <PopupWrapper screenPosition={screenPosition} dimensions={{width: 400, height: 100}} accessible={true}>
            <div
                className={styles.popupContent}
                style={{height: '60px', justifyContent: 'center'}}
                data-testid="error-message-popup-content"
            >
                <div className={styles.message}>{textMessage}</div>
            </div>
        </PopupWrapper>
    );
};

export default ErrorMessagePopup;
