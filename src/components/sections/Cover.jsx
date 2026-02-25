export default function Cover({ sectionsRef }) {
    // exactly the same scrollTo logic Sidebar uses internally:
    const scrollTo = (key) => {
      // find the index of the menu item by data-section name
      // Sidebar’s menuItems are ['cover','catchment','data','about'], so:
      const sectionOrder = ['cover', 'catchment', 'data', 'about'];
      const idx = sectionOrder.indexOf(key);
      if (idx !== -1 && sectionsRef.current[idx]) {
        sectionsRef.current[idx].scrollIntoView({ behavior: 'smooth' });
      }
    };
  
    return (
      <>
        <section
          className="section cover"
          data-section="cover"
          ref={(el) => (sectionsRef.current[0] = el)}
        >
          <div className="cover-content">
            <h1>RewetFlux</h1>
            <p style={{ color: '#ccc', fontSize: '1.2rem', marginTop: '0.5rem' }}>
              CO&#x2082; monitoring in wetlands
            </p>
          </div>
          <button
            className="down-arrow"
            onClick={() => scrollTo('catchment')}
            aria-label="Scroll down"
          >
            ↓
          </button>
          <div className="attribution">
            <a
              href="https://www.epfl.ch"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/epfl.png"
                alt="EPFL Logo"
                style={{ height: '2rem', marginRight: '1rem' }}
              />
            </a>
            <a
              href="https://www.snf.ch"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/snsf.svg"
                alt="SNSF Logo"
                style={{ height: '2rem' }}
              />
            </a>
          </div>
        </section>
      </>
    );
  }
  