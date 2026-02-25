import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geotiff';
import 'leaflet/dist/leaflet.css';

const dataOptions = [
  { key: 'Temperature', color: '#ff7f00' },
  { key: 'Moisture', color: '#1f77b4' },
  // Phase 2: { key: 'GasFlux', color: '#d62728' },
  // Phase 2: { key: 'Redox', color: '#2ca02c' },
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
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('cover');
  const [menuItems, setMenuItems] = useState([
    { key: 'cover', label: 'Home' },
    { key: 'catchment', label: 'Catchment', subItems: [] },
    { key: 'data', label: 'Data', subItems: [] },
    { key: 'about', label: 'About' },
  ]);

  const expBtnRef = useRef(null);
  const modBtnRef = useRef(null);
  const [thumbStyle, setThumbStyle] = useState({ left: 0, width: 0 });

  const scrollTo = key => {
    const idx = menuItems.findIndex(i => i.key === key);
    sectionsRef.current[idx]?.scrollIntoView({ behavior: 'smooth' });
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
    if (activeSection === 'catchment' && areas.length) {
      const subs = areas.map(a => ({ key: a.id, label: a.name }));
      setMenuItems(items =>
        items.map(item =>
          item.key === 'catchment' ? { ...item, subItems: subs } : item
        )
      );
    }
  }, [activeSection, areas]);

  useEffect(() => {
    setMenuItems(items =>
      items.map(item => {
        if (item.key !== 'data') return item;
        return {
          ...item,
          subItems: activeAreaId
            ? viewMode === 'experimental'
              ? dataOptions.map(o => ({ key: o.key, label: o.key }))
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
                    if (item.key === 'catchment' || item.key === 'about') {
                      clearArea();
                    }
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

              {item.key === 'catchment' && activeSection === 'catchment' && (
                <ul className="sub-menu">
                  {item.subItems.map(s => (
                    <li
                      key={s.key}
                      className={activeAreaId === s.key ? 'active-area' : ''}
                    >
                      <button
                        className={`submenu-btn ${
                          activeAreaId === s.key ? 'active-data' : ''
                        }`}
                        onClick={() => {
                          selectArea(s.key, true);
                        }}
                      >
                        {s.label}
                      </button>
                      {activeAreaId === s.key && (
                        <button
                          className="remove-selected"
                          onClick={() => {
                            clearArea();
                            scrollTo('catchment');
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {item.key === 'data' && activeAreaId && (
                <>
                  <hr
                    style={{
                      width: '90%',
                      margin: '1rem auto',
                      marginLeft: '0',
                      display: 'block',
                    }}
                  />
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
                          onClick={() => selectData(s.key)}
                        >
                          {s.label}
                        </button>
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
