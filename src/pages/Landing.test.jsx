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

  it('credits the developer at the end of the overlay, with a link to each profile', () => {
    act(() => about().click());
    const credit = dialog().querySelector('.landing-overlay-credit');
    expect(credit.textContent).toBe('Development: Evan Thomas');
    expect([...credit.querySelectorAll('a')].map(a => a.getAttribute('aria-label'))).toEqual([
      'Evan Thomas on GitHub',
      'Evan Thomas on LinkedIn',
      'Website of Evan Thomas',
    ]);
  });

  it('offers a button that plays or pauses the background footage', () => {
    const video = container.querySelector('.landing-background video');
    const button = container.querySelector('.landing-video-toggle');
    act(() => video.dispatchEvent(new Event('play')));
    expect(button.getAttribute('aria-label')).toBe('Pause the background video');
    act(() => video.dispatchEvent(new Event('pause')));
    expect(button.getAttribute('aria-label')).toBe('Play the background video');
  });

  it('shows the still until the footage plays, and leaves the footage to load later', () => {
    const video = container.querySelector('.landing-background video');
    expect(video.getAttribute('poster')).toBe('./balmoos.jpg');
    expect(video.getAttribute('preload')).toBe('none');
  });

  it('plays the background footage muted and looped', () => {
    const video = container.querySelector('.landing-background video');
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
  });
});
