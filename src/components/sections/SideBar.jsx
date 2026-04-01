import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geotiff';
import 'leaflet/dist/leaflet.css';

const dataOptions = [
  { key: 'Redox', color: '#2ca02c', label: 'Redox' },
  { key: 'Temperature', color: '#ff7f00', label: 'Temperature' },
  { key: 'Moisture', color: '#1f77b4', label: 'Moisture' },
];
const modelOptions = [];

export default function SideBar({
  sectionsRef,
  areas,
  activeAreaId,
  selectedData,
  viewMode,
  selectArea,
  clearArea,
  selectData,
  setViewMode,
  redoxDepth,
  setRedoxDepth,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('cover');
  const [menuItems, setMenuItems] = useState([
    { key: 'cover', label: 'Home' },
    { key: 'data', label: 'Data', subItems: [] },
    { key: 'about', label: 'About' },
  ]);

  const expBtnRef = useRef(null);
  const modBtnRef = useRef(null);
  const [thumbStyle, setThumbStyle] = useState({ left: 0, width: 0 });

  const scrollTo = key => {
    const section = sectionsRef.current.find(
      el => el && el.dataset.section === key
    );
    section?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.dataset.section);
          }
        });
      },
      { threshold: 0.6 }
    );
    sectionsRef.current.forEach(el => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sectionsRef]);

  useEffect(() => {
    if (activeSection !== 'cover') {
      setSidebarOpen(true);
    }
  }, [activeSection]);



  useEffect(() => {
    setMenuItems(items =>
      items.map(item => {
        if (item.key !== 'data') return item;
        return {
          ...item,
          subItems: activeAreaId
            ? viewMode === 'experimental'
              ? dataOptions.map(o => ({ key: o.key, label: o.label || o.key }))
              : modelOptions
            : [],
        };
      })
    );
  }, [activeAreaId, viewMode]);

  useLayoutEffect(() => {
    const updateThumb = () => {
      const ref = viewMode === 'experimental' ? expBtnRef : modBtnRef;
      if (ref.current) {
        const { offsetLeft, offsetWidth } = ref.current;
        setThumbStyle({ left: offsetLeft, width: offsetWidth });
      }
    };
    updateThumb();
    window.addEventListener('resize', updateThumb);
    return () => window.removeEventListener('resize', updateThumb);
  }, [viewMode, activeAreaId]);

  return (
    <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
      <div
        className="grabber"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      />
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? (
          <ChevronLeftIcon fontSize="large" />
        ) : (
          <ChevronRightIcon fontSize="large" />
        )}
      </button>
      <nav>
        <ul>
          {menuItems.map(item => (
            <li
              key={item.key}
              className={activeSection === item.key ? 'active' : ''}
            >
              {item.key !== 'data' && (
                <button
                  type="button"
                  className="menu-btn"
                  onClick={() => {
                    scrollTo(item.key);
                  }}
                >
                  {activeSection === item.key ? (
                    <strong>{item.label}</strong>
                  ) : (
                    item.label
                  )}
                </button>
              )}

              {item.key === 'data' && activeAreaId && (
                <>
                  <hr
                    style={{
                      width: '90%',
                      margin: '1rem auto 0.5rem 0',
                      display: 'block',
                    }}
                  />
                  <button
                    className={`submenu-btn site-title ${activeSection === 'catchment' ? 'active-data' : ''}`}
                    onClick={() => scrollTo('catchment')}
                  >
                    Balmoos
                  </button>
                  {modelOptions.length > 0 && (
                    <div className="mode-switch">
                      <div
                        className="mode-switch-thumb"
                        style={{ left: thumbStyle.left, width: thumbStyle.width }}
                      />
                      <button
                        ref={expBtnRef}
                        className={`mode-btn ${
                          viewMode === 'experimental' ? 'active' : ''
                        }`}
                        onClick={() => setViewMode('experimental')}
                      >
                        Experimental
                      </button>
                      <button
                        ref={modBtnRef}
                        className={`mode-btn ${
                          viewMode === 'model' ? 'active' : ''
                        }`}
                        onClick={() => setViewMode('model')}
                      >
                        Model
                      </button>
                    </div>
                  )}

                  <ul className="sub-menu">
                    {item.subItems.map(s => (
                      <li key={s.key}>
                        <button
                          className={`submenu-btn ${
                            selectedData === s.key ? 'active-data' : ''
                          }`}
                          onClick={() => {
                            selectData(s.key);
                            scrollTo('catchment');
                          }}
                        >
                          {s.label}
                        </button>
                        {selectedData === 'Redox' && s.key === 'Redox' && (
                          <ul className="sub-menu">
                            <li>
                              <button
                                className={`submenu-btn ${redoxDepth === 'top' ? 'active-data' : ''}`}
                                onClick={() => {
                                  setRedoxDepth('top');
                                  scrollTo('catchment');
                                }}
                              >
                                Top
                              </button>
                            </li>
                            <li>
                              <button
                                className={`submenu-btn ${redoxDepth === 'bottom' ? 'active-data' : ''}`}
                                onClick={() => {
                                  setRedoxDepth('bottom');
                                  scrollTo('catchment');
                                }}
                              >
                                Bottom
                              </button>
                            </li>
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>

                  <hr
                    style={{
                      width: '90%',
                      margin: '1rem auto',
                      marginLeft: '0',
                      display: 'block',
                    }}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
