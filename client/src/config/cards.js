// Card configuration with values, labels, and icons
export const CARD_CONFIG = [
  { value: 0, label: '', icon: '☕' },
  { value: 0.5, label: '0.5', icon: null },
  { value: 1, label: '1', icon: null },
  { value: 2, label: '2', icon: null },
  { value: 3, label: '3', icon: null },
  { value: 4, label: '4', icon: null },
  { value: 5, label: '5', icon: null },
  { value: 6, label: '6', icon: null },
  { value: 7, label: '7', icon: null },
  { value: 8, label: '8', icon: null }
];

// Legacy export for backward compatibility
export const CARD_VALUES = CARD_CONFIG.map(card => card.value);

/**
 * Maps a card value to a color based on severity scale
 * 0.5 = full green, increasing through yellow/orange to red for highest values
 * Uses HSL color space for smooth transitions
 * @param {number} value - The card value
 * @returns {string} - Hex color code
 */
export function getCardColor(value) {
  // Handle "Not Voting" card (value 0) - neutral gray
  if (value === 0) {
    return '#757575';
  }

  // Define color range in HSL
  // Green (0.5) -> Yellow -> Orange -> Red (8)
  const minValue = 0.5;
  const maxValue = 8;
  
  // Clamp value to valid range
  const clampedValue = Math.max(minValue, Math.min(maxValue, value));
  
  // Normalize to 0-1 range
  const normalized = (clampedValue - minValue) / (maxValue - minValue);
  
  // HSL color interpolation
  // Green: hsl(120, 70%, 50%) -> Yellow: hsl(60, 70%, 50%) -> Orange: hsl(30, 70%, 50%) -> Red: hsl(0, 70%, 50%)
  // We'll use a smooth transition through the hue spectrum
  let hue;
  if (normalized < 0.33) {
    // Green to Yellow (120 to 60)
    const t = normalized / 0.33;
    hue = 120 - (60 * t);
  } else if (normalized < 0.66) {
    // Yellow to Orange (60 to 30)
    const t = (normalized - 0.33) / 0.33;
    hue = 60 - (30 * t);
  } else {
    // Orange to Red (30 to 0)
    const t = (normalized - 0.66) / 0.34;
    hue = 30 - (30 * t);
  }
  
  const saturation = 70;
  const lightness = 50;
  
  // Convert HSL to RGB
  return hslToHex(hue, saturation, lightness);
}

/**
 * Converts HSL color to hex
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} - Hex color code
 */
function hslToHex(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  const toHex = (x) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Gets card configuration for a specific value
 * @param {number} value - The card value
 * @returns {Object|null} - Card configuration object or null if not found
 */
export function getCardConfig(value) {
  return CARD_CONFIG.find(card => card.value === value) || null;
}

