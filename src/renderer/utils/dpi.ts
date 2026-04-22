/**
 * DPI 检测和页面尺寸计算工具
 */

// 毫米转英寸的比率
const MM_PER_INCH = 25.4;

/**
 * 获取用户设置的目标 DPI
 * @param targetDPI 用户设置的目标 DPI（默认 96）
 */
export const getCalibratedDPI = (targetDPI: number = 96): number => {
  return targetDPI;
};

/**
 * 毫米转像素
 * @param mm 毫米值
 * @param dpi DPI（默认 96）
 */
export const mmToPixels = (mm: number, dpi: number = 96): number => {
  return mm * (dpi / MM_PER_INCH);
};

/**
 * 像素转毫米
 * @param px 像素值
 * @param dpi DPI（默认 96）
 */
export const pixelsToMm = (px: number, dpi: number = 96): number => {
  return px * (MM_PER_INCH / dpi);
};

/**
 * 获取页面标准尺寸（毫米）
 */
export const PAGE_SIZES_MM = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
} as const;

/**
 * 获取页面像素尺寸
 * @param size 页面尺寸类型
 * @param orientation 方向
 * @param dpi DPI
 */
export const getPageDimensionsPixels = (
  size: 'A4' | 'A3',
  orientation: 'portrait' | 'landscape',
  dpi: number = 96
): { width: number; height: number } => {
  const pageSize = PAGE_SIZES_MM[size];
  const isPortrait = orientation === 'portrait';
  
  return {
    width: Math.round(isPortrait ? pageSize.width : pageSize.height) * (dpi / MM_PER_INCH),
    height: Math.round(isPortrait ? pageSize.height : pageSize.width) * (dpi / MM_PER_INCH),
  };
};
