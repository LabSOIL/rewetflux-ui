import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Landing from './Landing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Landing', () => {
  let container;
  let root;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Landing />
        </MemoryRouter>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const about = () => container.querySelector('.landing-card-about');
  const dialog = () => container.querySelector('[role="dialog"]');

  it('shows two cards: a map preview that links to the map, and the project', () => {
    const cards = container.querySelectorAll('.landing-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute('href')).toBe('/map');
    expect(cards[0].querySelector('.leaflet-container')).not.toBeNull();
    expect(about()).toBe(cards[1]);
  });

  it('opens the project overlay from its card and closes it on Escape', () => {
    expect(dialog()).toBeNull();
    act(() => about().click());
    expect(dialog()).not.toBeNull();
    expect(document.activeElement.getAttribute('aria-label')).toBe('Close');
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(dialog()).toBeNull();
  });

  it('closes the overlay on a click outside the card but not inside it', () => {
    act(() => about().click());
    act(() => dialog().click());
    expect(dialog()).not.toBeNull();
    act(() => container.querySelector('.landing-overlay').click());
    expect(dialog()).toBeNull();
  });

  it('plays the background footage muted and looped', () => {
    const video = container.querySelector('.landing-background video');
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
  });
});
