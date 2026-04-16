import { useEffect } from 'react';
import { logger } from '../utils/logger';

export const useFontLoading = () => {
  useEffect(() => {
    const loadFonts = async () => {
      try {
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
