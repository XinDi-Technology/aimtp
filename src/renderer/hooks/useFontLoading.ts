import { useEffect } from 'react';
import { logger } from '../utils/logger';

export const useFontLoading = () => {
  useEffect(() => {
    const loadFonts = async () => {
      try {
        // TODO: [P2-问题4] 只验证了 GWM Sans UI，应该验证所有使用的字体
        // 项目中还使用了 JetBrains Mono 和 Monaspace Argon
        const fontLoaded = await document.fonts.load('12px "GWM Sans UI"');
        if (fontLoaded.length > 0) {
          logger.log('GWM Sans UI font loaded successfully');
        } else {
          logger.warn('GWM Sans UI font failed to load');
        }
      } catch (error) {
        logger.error('Error loading fonts:', error);
      }
    };

    loadFonts();
  }, []);
};
