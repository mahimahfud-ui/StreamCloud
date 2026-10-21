// Three separate categories backed by the existing catalog and render functions.
// The data itself remains in index.html so search, filtering, sorting, favourites and details
// continue to use the same records and event handlers.

export function initCategories() {
  const modeSwitch = document.querySelector('.mode-switch');
  const sitesView = document.getElementById('sitesView');
  const appsView = document.getElementById('appsView');
  const sharedCatalog = window.MAHIFLIX_CATALOG;
  if (!modeSwitch || !sitesView || !appsView || !sharedCatalog) return;

  const sitesButton = modeSwitch.querySelector('.mode[data-mode="sites"]');
  const movieButton = modeSwitch.querySelector('.mode[data-mode="apps"]');
  if (!sitesButton || !movieButton) return;

  const siteItems = Array.from(sharedCatalog.sites || []);
  const allApps = Array.from(sharedCatalog.apps || []);
  const movieApps = allApps.filter(item => item && item.appType === 'movie');
  const musicApps = allApps.filter(item => item && item.appType === 'music');
  if (!movieApps.length && !musicApps.length) return;

  const labels = { sites: 'Websites', movie: 'Movie Apps', music: 'Music Apps' };
  const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  let initialHash = (location.hash || '').slice(1);
  try { initialHash = decodeURIComponent(initialHash); } catch (_) { /* ignore malformed hashes */ }
  const hashSlug = slug(initialHash);
  const initialItem = [...siteItems, ...allApps].find(item => slug(item.name) === hashSlug);
  let selectedCategory = initialItem
    ? (initialItem.appType === 'music' ? 'music' : initialItem.appType === 'movie' ? 'movie' : 'sites')
    : (movieButton.classList.contains('active') ? 'movie' : 'sites');
  let switchingInternally = false;

  const existingMusicButtons = modeSwitch.querySelectorAll('.mode[data-mode="music"]');
  let musicButton;
  if (existingMusicButtons.length > 0) {
    musicButton = existingMusicButtons[0];
    for (let i = 1; i < existingMusicButtons.length; i++) {
      existingMusicButtons[i].remove();
    }
  } else {
    musicButton = document.createElement('button');
    musicButton.className = 'mode';
    musicButton.type = 'button';
    musicButton.dataset.mode = 'music';
    musicButton.setAttribute('role', 'tab');
    musicButton.setAttribute('aria-controls', 'appsView');
    musicButton.setAttribute('aria-selected', 'false');
    musicButton.tabIndex = -1;
    musicButton.textContent = 'MUSIC APPS';
    modeSwitch.appendChild(musicButton);
  }

  sitesButton.textContent = 'WEBSITES';
  movieButton.textContent = 'MOVIE APPS';
  sitesButton.setAttribute('aria-controls', 'sitesView');
  movieButton.setAttribute('aria-controls', 'appsView');

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
    return selectedCategory === 'sites' ? sitesButton : selectedCategory === 'movie' ? movieButton : musicButton;
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
    const view = selectedCategory === 'sites' ? sitesView : appsView;
    const rowSelector = selectedCategory === 'sites'
      ? '.row-section[data-row="movie websites"]'
      : selectedCategory === 'movie'
        ? '.row-section[data-row="movie apps"]'
        : '.row-section[data-row="music apps"]';
    const row = view.querySelector(rowSelector);
    const visibleCount = row
      ? Array.from(row.querySelectorAll('.card')).filter(card => card.style.display !== 'none').length
      : 0;
    empty.style.display = visibleCount ? 'none' : 'block';
    if (!visibleCount) {
      const query = document.getElementById('q');
      empty.textContent = selectedCategory === 'sites' && siteItems.length === 0 && !(query && query.value.trim())
        ? 'No websites added yet. Send ChatGPT a message like Website - https://example.com to add one.'
        : 'No listings found in ' + labels[selectedCategory] + ' with the current search or filters.';
    }
  }

  function updateCategoryView() {
    window.STREAMCLOUD_ACTIVE_CATEGORY = selectedCategory;
    sitesView.dataset.category = 'sites';
    appsView.dataset.category = selectedCategory;
    sitesView.classList.toggle('active', selectedCategory === 'sites');
    appsView.classList.toggle('active', selectedCategory !== 'sites');
    [sitesButton, movieButton, musicButton].forEach(button => {
      const active = button === activeButton();
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

  // Capture the new Music Apps tab and route it through the original Apps renderer.
  // That keeps the existing app render, modal, search, sorting and favourite systems in sync.
  modeSwitch.addEventListener('click', event => {
    const button = event.target.closest('.mode');
    if (!button || !modeSwitch.contains(button)) return;
    if (switchingInternally) return;

    if (button === musicButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      // Use the original catalogue renderer's explicit music mode. Previously this
      // clicked the Movie Apps tab as a workaround, which rendered movie entries
      // into appsView while the UI label showed Music Apps.
      if (typeof window.STREAMCLOUD_SET_MODE === 'function') {
        window.STREAMCLOUD_SET_MODE('music');
      } else {
        // Compatibility fallback for older cached index.html versions.
        switchingInternally = true;
        try { movieButton.click(); } finally { switchingInternally = false; }
      }
      selectCategory('music');
      return;
    }
    if (button === sitesButton) selectCategory('sites');
    else if (button === movieButton) selectCategory('movie');
  }, true);

  modeSwitch.addEventListener('keydown', event => {
    const current = event.target.closest('.mode');
    if (!current || !modeSwitch.contains(current)) return;
    const buttons = [sitesButton, movieButton, musicButton];
    const index = buttons.indexOf(current);
    if (index < 0) return;
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next].focus();
    buttons[next].click();
  });


  // Rebuilds triggered by the existing search/filter/sort code only need visibility/empty-state sync.
  const viewObserver = new MutationObserver(updateCategoryView);
  viewObserver.observe(sitesView, { childList: true, subtree: true });
  viewObserver.observe(appsView, { childList: true, subtree: true });

  const search = document.getElementById('q');
  if (search) search.addEventListener('input', updateEmptyState);
  addEventListener('resize', positionThumb, { passive: true });
  addEventListener('orientationchange', positionThumb, { passive: true });

  updateCategoryView();
}
