// StreamCloud category tabs share the original catalog renderer but keep each
// category in its own view. This prevents cards and active states crossing sections.
export function initCategories() {
  const modeSwitch = document.querySelector('.mode-switch');
  const sitesView = document.getElementById('sitesView');
  const appsView = document.getElementById('appsView');
  const musicView = document.getElementById('musicView');
  const gamingView = document.getElementById('gamingView');
  const tvView = document.getElementById('tvView');
  const sharedCatalog = window.MAHIFLIX_CATALOG;
  if (!modeSwitch || !sitesView || !appsView || !musicView || !gamingView || !tvView || !sharedCatalog) return;

  const sitesButton = modeSwitch.querySelector('.mode[data-mode="sites"]');
  const movieButton = modeSwitch.querySelector('.mode[data-mode="apps"]');
  const gamingButton = modeSwitch.querySelector('.mode[data-mode="gaming"]');
  const tvButton = modeSwitch.querySelector('.mode[data-mode="tv"]');
  if (!sitesButton || !movieButton || !gamingButton || !tvButton) return;

  const siteItems = Array.from(sharedCatalog.sites || []);
  const allApps = Array.from(sharedCatalog.apps || []);
  const gamingItems = Array.from(sharedCatalog.gaming || []);
  const tvItems = Array.from(sharedCatalog.tv || []);
  const labels = {
    sites: 'Websites',
    movie: 'Movie Apps',
    music: 'Music Apps',
    gaming: 'Gaming Websites',
    tv: 'TV Apps'
  };
  const buttons = {
    sites: sitesButton,
    movie: movieButton,
    music: modeSwitch.querySelector('.mode[data-mode="music"]'),
    gaming: gamingButton,
    tv: tvButton
  };
  let musicButton = buttons.music;
  if (!musicButton) {
    musicButton = document.createElement('button');
    musicButton.className = 'mode';
    musicButton.type = 'button';
    musicButton.dataset.mode = 'music';
    musicButton.setAttribute('role', 'tab');
    musicButton.textContent = 'MUSIC APPS';
    modeSwitch.insertBefore(musicButton, gamingButton);
    buttons.music = musicButton;
  }

  const views = {
    sites: sitesView,
    movie: appsView,
    music: musicView,
    gaming: gamingView,
    tv: tvView
  };
  const modeForCategory = {
    sites: 'sites',
    movie: 'apps',
    music: 'music',
    gaming: 'gaming',
    tv: 'tv'
  };
  const categoryForMode = {
    sites: 'sites',
    apps: 'movie',
    music: 'music',
    gaming: 'gaming',
    tv: 'tv'
  };
  const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  let initialHash = (location.hash || '').slice(1);
  try { initialHash = decodeURIComponent(initialHash); } catch (_) { /* ignore malformed hashes */ }
  const hashSlug = slug(initialHash);
  const initialItem = [...siteItems, ...allApps, ...gamingItems, ...tvItems]
    .find(item => slug(item.name) === hashSlug);
  const initialCategory = initialItem
    ? initialItem.appType === 'music' ? 'music'
      : initialItem.appType === 'movie' ? 'movie'
        : initialItem.appType === 'gaming' ? 'gaming'
          : initialItem.appType === 'tv' ? 'tv' : 'sites'
    : categoryForMode[Object.keys(buttons).map(key => [key, buttons[key]])
      .find(([, button]) => button.classList.contains('active'))?.[1]?.dataset.mode || 'sites'] || 'sites';
  let selectedCategory = initialCategory;

  Object.entries(buttons).forEach(([category, button]) => {
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', views[category].id);
    if (!button.hasAttribute('aria-selected')) button.setAttribute('aria-selected', 'false');
  });
  sitesButton.textContent = 'WEBSITES';
  movieButton.textContent = 'MOVIE APPS';
  musicButton.textContent = 'MUSIC APPS';
  gamingButton.textContent = 'GAMING WEBSITES';
  tvButton.textContent = 'TV APPS';

  let thumb = modeSwitch.querySelector('.mode-thumb');
  if (!thumb) {
    thumb = document.createElement('span');
    thumb.className = 'mode-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    modeSwitch.prepend(thumb);
  }
  modeSwitch.classList.add('has-thumb', 'streamcloud-tabs-ready');
  document.documentElement.classList.add('streamcloud-categories-ready');

  window.STREAMCLOUD_ACTIVE_CATEGORY = selectedCategory;

  function activeButton() {
    return buttons[selectedCategory] || sitesButton;
  }

  function positionThumb() {
    const active = activeButton();
    const width = active.getBoundingClientRect().width;
    if (!width) return;
    thumb.style.width = width + 'px';
    thumb.style.transform = 'translateX(' + Math.max(0, active.offsetLeft - 5) + 'px)';
  }

  function updateEmptyState() {
    const empty = document.getElementById('empty');
    if (!empty) return;
    const view = views[selectedCategory];
    const rowNames = {
      sites: 'movie websites',
      movie: 'movie apps',
      music: 'music apps',
      gaming: 'gaming websites',
      tv: 'tv apps'
    };
    const row = view.querySelector('.row-section[data-row="' + rowNames[selectedCategory] + '"]');
    const visibleCount = row
      ? Array.from(row.querySelectorAll('.card')).filter(card => card.style.display !== 'none').length
      : 0;
    empty.style.display = visibleCount ? 'none' : 'block';
    if (!visibleCount) {
      const query = document.getElementById('q');
      if (selectedCategory === 'tv' && !(query && query.value.trim())) {
        empty.textContent = 'TV Apps are ready. Listings will appear here when real TV apps are added.';
      } else if (selectedCategory === 'sites' && siteItems.length === 0 && !(query && query.value.trim())) {
        empty.textContent = 'No websites added yet. Send ChatGPT a message like Website - https://example.com to add one.';
      } else {
        empty.textContent = 'No listings found in ' + labels[selectedCategory] + ' with the current search or filters.';
      }
    }
  }

  function updateCategoryView() {
    window.STREAMCLOUD_ACTIVE_CATEGORY = selectedCategory;
    Object.entries(views).forEach(([category, view]) => {
      view.dataset.category = category === 'movie' ? 'movie' : category;
      view.classList.toggle('active', category === selectedCategory);
    });
    Object.entries(buttons).forEach(([category, button]) => {
      const active = category === selectedCategory;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    positionThumb();
    updateEmptyState();
  }

  function selectCategory(category) {
    if (!Object.prototype.hasOwnProperty.call(labels, category)) return;
    selectedCategory = category;
    updateCategoryView();
  }

  // Route all tabs through the existing renderer; the captured event prevents
  // legacy click listeners from activating a second, unrelated view.
  modeSwitch.addEventListener('click', event => {
    const button = event.target.closest('.mode');
    if (!button || !modeSwitch.contains(button)) return;
    const entry = Object.entries(buttons).find(([, candidate]) => candidate === button);
    if (!entry) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const [category] = entry;
    if (typeof window.STREAMCLOUD_SET_MODE === 'function') {
      window.STREAMCLOUD_SET_MODE(modeForCategory[category]);
    }
    selectCategory(category);
  }, true);

  modeSwitch.addEventListener('keydown', event => {
    const current = event.target.closest('.mode');
    const ordered = Object.values(buttons);
    const index = ordered.indexOf(current);
    if (index < 0) return;
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % ordered.length;
    else if (event.key === 'ArrowLeft') next = (index + ordered.length - 1) % ordered.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ordered.length - 1;
    else return;
    event.preventDefault();
    ordered[next].focus();
    ordered[next].click();
  });

  // Keep category state correct after search, filters, sorting or admin catalogue updates.
  const viewObserver = new MutationObserver(updateCategoryView);
  Object.values(views).forEach(view => viewObserver.observe(view, { childList: true, subtree: true }));

  const search = document.getElementById('q');
  if (search) search.addEventListener('input', updateEmptyState);
  addEventListener('resize', positionThumb, { passive: true });
  addEventListener('orientationchange', positionThumb, { passive: true });

  updateCategoryView();
}
