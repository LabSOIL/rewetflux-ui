// The funders, one list for the map overlay. Each logo links to its site.
const FUNDERS = [
  { href: 'https://www.epfl.ch', src: './epfl.png', alt: 'EPFL Logo' },
  { href: 'https://e4s.center/', src: './e4s.svg', alt: 'Enterprise for Society Center Logo' },
  {
    href: 'https://www.pronatura-lu.ch/de/balmoos-regeneration-hochmoor',
    src: './pronatura.svg',
    alt: 'Pro Natura Logo',
  },
];

/** The funders' logos as one overlay at the bottom right of the map, above the date bar. */
export default function MapLogos() {
  return (
    <div className="map-logos">
      {FUNDERS.map(f => (
        <a key={f.alt} href={f.href} target="_blank" rel="noopener noreferrer">
          <img src={f.src} alt={f.alt} />
        </a>
      ))}
    </div>
  );
}
