import iconUrl from './tower-icon.png';
import layout from './tower-icon.json';

/**
 * The map's icon of the tower, drawn from its 3D model: `{ url, size: [width, height], anchor: [x, y] }`
 * in pixels, the anchor at the tower's foot. scripts/tower.py writes it.
 */
export const getTowerIcon = () => ({ url: iconUrl, ...layout });
