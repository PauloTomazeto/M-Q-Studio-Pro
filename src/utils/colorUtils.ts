/**
 * Utility functions for color temperature and Kelvin conversions
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Converts Kelvin color temperature to RGB
 * Algorithm based on Tanner Helland's work
 */
export const kelvinToRGB = (kelvin: number): RGB => {
  const temp = kelvin / 100;
  let r, g, b;

  if (temp <= 66) {
    r = 255;
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    if (temp <= 19) {
      b = 0;
    } else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
    }
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    b = 255;
  }

  return {
    r: Math.min(255, Math.max(0, r)),
    g: Math.min(255, Math.max(0, g)),
    b: Math.min(255, Math.max(0, b)),
  };
};

export const rgbToHex = (rgb: RGB): string => {
  const toHex = (c: number) => Math.round(c).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
};

export const kelvinToHex = (kelvin: number): string => {
  return rgbToHex(kelvinToRGB(kelvin));
};

/**
 * Clamps temperature to the valid range 2700K - 8000K
 */
export const clampTemperature = (kelvin: number): number => {
  return Math.min(8000, Math.max(2700, kelvin));
};

/**
 * Rounds temperature to the nearest 100K
 */
export const roundTemperature = (kelvin: number): number => {
  return Math.round(kelvin / 100) * 100;
};

/**
 * Calculates rendering impact based on temperature
 * Returns suggested adjustments for bloom, saturation, and hue shift
 */
export const calculateRenderingImpact = (kelvin: number) => {
  // Neutral is 5500K
  const diff = kelvin - 5500;
  
  // Warmer (lower K) -> More saturation, slight orange hue shift
  // Cooler (higher K) -> Less saturation, slight blue hue shift
  const saturationImpact = -(diff / 8000) * 20; // -10 to +10 range approx
  const hueShiftImpact = (diff / 8000) * 15; // -10 to +10 range approx
  const bloomIntensity = kelvin < 4000 ? 15 : (kelvin > 7000 ? 10 : 5);

  return {
    saturation: Math.round(saturationImpact),
    hueShift: Math.round(hueShiftImpact),
    bloom: bloomIntensity,
    bloomColor: kelvinToHex(kelvin)
  };
};

export const TEMPERATURE_PRESETS = {
  candle_light: { value: 1900, label: 'Candle Light', description: 'Luz de vela, muito quente' },
  tungsten_incandescent: { value: 2700, label: 'Tungsten', description: 'Lâmpada incandescente, quente' },
  fluorescent_warm: { value: 3500, label: 'Fluorescent Warm', description: 'Fluorescente quente, amarelado' },
  daylight: { value: 5500, label: 'Daylight', description: 'Luz natural, neutro (padrão)' },
  overcast: { value: 6500, label: 'Overcast', description: 'Dia nublado, levemente azul' },
  shade: { value: 7500, label: 'Shade', description: 'Sombra com céu azul, mais azul' },
  blue_sky: { value: 8000, label: 'Clear Sky', description: 'Céu limpo, muito azul' }
};

export const getTemperatureState = (kelvin: number) => {
  if (kelvin <= 3500) return { label: 'Muito Quente', color: 'text-orange-500' };
  if (kelvin <= 5500) return { label: 'Neutro', color: 'text-yellow-200' };
  if (kelvin <= 6500) return { label: 'Moderadamente Frio', color: 'text-blue-300' };
  return { label: 'Muito Frio', color: 'text-blue-500' };
};
