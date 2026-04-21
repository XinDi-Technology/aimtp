/**
 * DPI 检测和页面尺寸计算工具
 */

// 默认 DPI（CSS 标准）
const DEFAULT_DPI = 96;

// 毫米转英寸的比率
const MM_PER_INCH = 25.4;

/**
 * 获取屏幕 DPI
 * 尝试多种方法获取真实 DPI
 */
export const getScreenDPI = (): number => {
  // 方法1：使用 devicePixelRatio（最常用的方法）
  const dpr = window.devicePixelRatio || 1;
  
  // 方法2：尝试通过创建物理元素来测量（更精确但需要用户交互）
  // 这里我们结合两种方法
  
  // 在某些浏览器中，可以通过 screen.width 和物理像素宽度的比值来估算
  // 但大多数情况下 devicePixelRatio 是最可靠的
  
  return Math.round(DEFAULT_DPI * dpr);
};

/**
 * 获取经过校准的 DPI
 * @param calibration 用户设置的校准系数（默认 1.0）
 */
export const getCalibratedDPI = (calibration: number = 1): number => {
  return Math.round(getScreenDPI() * calibration);
};

/**
 * 毫米转像素
 * @param mm 毫米值
 * @param dpi DPI（默认 96）
 */
export const mmToPixels = (mm: number, dpi: number = DEFAULT_DPI): number => {
  return mm * (dpi / MM_PER_INCH);
};

/**
 * 像素转毫米
 * @param px 像素值
 * @param dpi DPI（默认 96）
 */
export const pixelsToMm = (px: number, dpi: number = DEFAULT_DPI): number => {
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
  dpi: number = DEFAULT_DPI
): { width: number; height: number } => {
  const pageSize = PAGE_SIZES_MM[size];
  const isPortrait = orientation === 'portrait';
  
  return {
    width: Math.round(isPortrait ? pageSize.width : pageSize.height) * (dpi / MM_PER_INCH),
    height: Math.round(isPortrait ? pageSize.height : pageSize.width) * (dpi / MM_PER_INCH),
  };
};

/**
 * 估算屏幕物理尺寸（英寸）
 * 这是一个粗略估算，基于常见的屏幕尺寸假设
 */
export const estimateScreenDiagonal = (): number => {
  // 大多数显示器的对角线估算值
  // 1920x1080 在 24 英寸屏幕上约为 96 DPI
  // 这个估算可能不太准确，但可以作为参考
  
  // 尝试通过常见的屏幕尺寸来估算
  const width = screen.width;
  const height = screen.height;
  
  // 计算对角线像素
  const diagonalPixels = Math.sqrt(width * width + height * height);
  
  // 假设 devicePixelRatio = 1 时是 96 DPI
  // 这是一个粗略假设
  const estimatedDPI = getScreenDPI();
  const estimatedDiagonal = diagonalPixels / estimatedDPI;
  
  return estimatedDiagonal;
};

/**
 * 计算实际 DPI（考虑屏幕物理尺寸）
 * 这个方法可以提供更精确的 DPI 估算
 */
export const calculateActualDPI = (screenDiagonalInches?: number): number => {
  const dpr = window.devicePixelRatio || 1;
  
  // 如果提供了物理尺寸，使用更精确的计算
  if (screenDiagonalInches && screenDiagonalInches > 0) {
    const widthInches = screen.width / getScreenDPI();
    const heightInches = screen.height / getScreenDPI();
    const actualDiagonal = Math.sqrt(widthInches * widthInches + heightInches * heightInches);
    
    // 比较物理对角线和计算对角线
    const scaleFactor = actualDiagonal / screenDiagonalInches;
    
    // 返回调整后的 DPI
    return Math.round(DEFAULT_DPI * dpr * scaleFactor);
  }
  
  // 回退到 devicePixelRatio * 96
  return Math.round(DEFAULT_DPI * dpr);
};
