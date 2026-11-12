import surroundings from './surroundings.json';
import terrain from './terrain.json';

/**
 * The ground of the block around the site: a swissALTI3D height grid regular in Web Mercator,
 * `{ source, bounds: [west, south, east, north], size: [columns, rows], base, heights }`, heights in
 * cm above `base` metres, rows from the north. scripts/terrain.py writes it.
 */
export const getTerrain = () => terrain;

/** The ground about 2.6 km across centred on the site, coarser, in the same shape. */
export const getSurroundings = () => surroundings;
