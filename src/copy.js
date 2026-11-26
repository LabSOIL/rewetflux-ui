/**
 * The words of the landing page, the project overlay and the map's info panel, in one place.
 * They are placeholders until the project's own text arrives: each states only what the map
 * itself shows (the site, what is measured, the partners), and the project's text replaces them
 * here.
 */
export const COPY = {
  title: ['BALMOOS', 'WETLAND MONITORING'],
  subtitle: 'Greenhouse gas fluxes, soil redox and microclimate at the Balmoos wetland, Lucerne',

  mapCard: {
    title: 'Explore the site',
    detail: 'The measurements at each position on the site, on a map in 2D and 3D.',
  },
  aboutCard: {
    title: 'About the project',
    detail: 'The site, what is measured and who is involved.',
    summary: 'A short description of the project will appear here.',
  },

  overlay: {
    kicker: 'The project',
    lead: 'A summary of the project and its aims will appear here.',
    site: 'A description of the Balmoos site will appear here.',
    measures: [
      { name: 'Gas flux', detail: 'CO₂ and CH₄ exchange between the soil and the air.' },
      { name: 'Redox potential', detail: 'Soil redox potential at 5, 15, 25 and 35 cm depth.' },
      { name: 'Temperature and moisture', detail: 'Soil temperature and volumetric water content (m³/m³).' },
    ],
  },
};
