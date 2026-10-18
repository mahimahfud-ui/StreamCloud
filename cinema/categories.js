// Adds three independent catalog tabs without duplicating the catalog or rewriting its render logic.
// Existing search, sorting, filtering, favourites, details, links, and keyboard handlers stay in place.

export function initCategories() {
  const modeSwitch = document.querySelector('.mode-switch');
  const sitesView = document.getElementById('sitesView');
  const appsView = document.getElementById('appsView');
  const catalog = window.MAHIFLIX_CATALOG;
  if (!modeSwitch || !sitesView || !appsView || !catalog) return;

  const sitesButton = modeSwitch.querySelector('.mode[data-mode="sites"]');
  const appsButton = modeSwitch.querySelector('.mode[data-mode="apps"]');
  if (!sitesButton || !appsButton) return;

  const sitesDescriptor = Object.getOwnPropertyDescriptor(catalog, 'sites');
  const appsDescriptor = Object.getOwnPropertyDescriptor(catalog, 'apps');
  const siteItems = Array.from(
    (sitesDescriptor && sitesDescriptor.get ? sitesDescriptor.get.call(catalog) : catalog.sites) || []
  );
  const allApps = Array.from(
    (appsDescriptor && appsDescriptor.get ? appsDescriptor.get.call(catalog) : catalog.apps) || []
  );
  const movieApps = allApps.filter(item => item && item.appType === 'movie');
  const musicApps = allApps.filter(item => item && item.appType === 'music');
  if (!siteItems.length || (!movieApps.length && !musicApps.length)) return;

  const labels = {
    sites: 'Websites',
    movie: 'Movie Apps',
    music: 'Music Apps',
  };
  const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let rawHash = (location.hash || '').slice(1);
  try { rawHash = decodeURIComponent(rawHash); } catch (_) { /* Ignore malformed external hashes. */ }
  const hashItem = slug(rawHash);
  const initialItem = [...siteItems, ...allApps].find(item => slug(item.name) === hashItem);
  let selectedCategory = initialItem
    ? (initialItem.appType === 'music' ? 'music' : initialItem.appType === 'movie' ? 'movie' : 'sites')
    : (sitesButton.classList.contains('active') ? 'sites' : 'movie');

  let internalMusicSwitch = false;
  let portalTravel = false;
  let portalCommitHandled = false;
  let portalSourceCategory = null;
  let portalTargetCategory = null;
  let portalTravelTimer = 0;
  let tabSyncQueued = false;

  const musicButton = document.createElement('button');
  musicButton.className = 'mode';
  musicButton.type = 'button';
  musicButton.dataset.mode = 'music';
  musicButton.setAttribute('role', 'tab');
  musicButton.setAttribute('aria-controls', 'appsView');
  musicButton.setAttribute('aria-selected', 'false');
  musicButton.tabIndex = -1;
  musicButton.textContent = 'MUSIC APPS';
  sitesButton.textContent = 'WEBSITES';
  appsButton.textContent = 'MOVIE APPS';
  sitesButton.setAttribute('aria-controls', 'sitesView');
  appsButton.setAttribute('aria-controls', 'appsView');
  modeSwitch.appendChild(musicButton);

  let thumb = modeSwitch.querySelector('.mode-thumb');
  if (!thumb) {
    thumb = document.createElement('span');
    thumb.className = 'mode-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    modeSwitch.prepend(thumb);
  }
  modeSwitch.classList.add('has-thumb', 'streamcloud-tabs-ready');
  document.documentElement.classList.add('streamcloud-categories-ready');

  // The portal is the only consumer of this shared catalog object. Give it the actual target
  // category for its reel instead of an all-apps mixture, while the original renderers keep using
  // their full lexical catalog arrays.
  Object.defineProperty(catalog, 'sites', {
    configurable: true,
    enumerable: true,
    get() {
      return selectedCategory === 'movie' ? musicApps : siteItems;
    },
  });
  Object.defineProperty(catalog, 'apps', {
    configurable: true,
    enumerable: true,
    get() {
      return portalTravel && portalTargetCategory === 'music' ? musicApps : movieApps;
    },
  });

  const targetCategory = category => category === 'sites' ? 'movie' : category === 'movie' ? 'music' : 'sites';
  const targetItems = category => category === 'sites' ? movieApps : category === 'movie' ? musicApps : siteItems;

  function updatePortalPresentation() {
    const portal = document.getElementById('portal');
    const name = document.getElementById('portalName');
    const count = document.getElementById('portalCount');
    const next = targetCategory(selectedCategory);
    if (name && name.textContent !== labels[next]) name.textContent = labels[next];
    if (count) {
      const nextCount = '[' + String(targetItems(selectedCategory).length).padStart(2, '0') + ']';
      if (count.textContent !== nextCount) count.textContent = nextCount;
    }
    if (portal) {
      const description = 'Jump to ' + labels[next];
      if (portal.getAttribute('aria-label') !== description) portal.setAttribute('aria-label', description);
      if (portal.dataset.label !== labels[next]) portal.dataset.label = labels[next];
    }
  }

  function positionThumb() {
    const active = selectedCategory === 'sites' ? sitesButton : selectedCategory === 'movie' ? appsButton : musicButton;
    if (!active || !thumb || !modeSwitch) return;
    const width = active.getBoundingClientRect().width;
    const left = active.offsetLeft - 5;
    if (width > 0) thumb.style.width = width + 'px';
    thumb.style.transform = 'translateX(' + Math.max(0, left) + 'px)';
  }

  function syncTabs() {
    // While the portal is preparing its Movie Apps -> Music Apps jump, the temporary Websites
    // active marker tells the existing portal animation to target the app view. Keep it until its
    // commit click arrives, then return to the real selected category.
    if (portalTravel && !portalCommitHandled) return;
    const buttons = [sitesButton, appsButton, musicButton];
    const activeButton = selectedCategory === 'sites' ? sitesButton : selectedCategory === 'movie' ? appsButton : musicButton;
    buttons.forEach(button => {
      const active = button === activeButton;
      if (button.classList.contains('active') !== active) button.classList.toggle('active', active);
      if (button.getAttribute('aria-selected') !== String(active)) button.setAttribute('aria-selected', String(active));
      if (button.tabIndex !== (active ? 0 : -1)) button.tabIndex = active ? 0 : -1;
    });
    positionThumb();
  }

  function updateCategoryView() {
    sitesView.dataset.category = 'sites';
    appsView.dataset.category = selectedCategory;
    sitesView.classList.toggle('active', selectedCategory === 'sites');
    appsView.classList.toggle('active', selectedCategory !== 'sites');
    syncTabs();
    updatePortalPresentation();
    updateEmptyState();
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
    const matchingCards = row ? Array.from(row.querySelectorAll('.card')).filter(card => card.style.display !== 'none').length : 0;
    const showEmpty = matchingCards === 0;
    empty.style.display = showEmpty ? 'block' : 'none';
    if (showEmpty) empty.textContent = 'No listings found in ' + labels[selectedCategory] + ' with the current search or filters.';
  }

  function setCategory(category) {
    if (!Object.prototype.hasOwnProperty.call(labels, category)) return;
    selectedCategory = category;
    updateCategoryView();
  }

  function queueCategorySync() {
    if (tabSyncQueued) return;
    tabSyncQueued = true;
    requestAnimationFrame(() => {
      tabSyncQueued = false;
      if (!portalTravel) {
        // The existing downloadable/anime quick filters can change the underlying two-view mode
        // without a tab click. Follow that automatic mode change, but never collapse Music Apps
        // back into the Movie Apps tab just because both share the original app renderer.
        if (selectedCategory === 'sites' && appsButton.classList.contains('active')) selectedCategory = 'movie';
        else if (selectedCategory !== 'sites' && sitesButton.classList.contains('active')) selectedCategory = 'sites';
      }
      updateCategoryView();
    });
  }

  modeSwitch.addEventListener('click', event => {
    const button = event.target.closest('.mode');
    if (!button || !modeSwitch.contains(button)) return;
    if (internalMusicSwitch) return;

    if (button === musicButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setCategory('music');
      internalMusicSwitch = true;
      try { appsButton.click(); } finally { internalMusicSwitch = false; }
      setCategory('music');
      return;
    }

    if (button !== sitesButton && button !== appsButton) return;
    if (portalTravel && !portalCommitHandled) {
      const expectedMode = portalTargetCategory === 'sites' ? 'sites' : 'apps';
      if (button.dataset.mode === expectedMode) {
        portalCommitHandled = true;
        setCategory(portalTargetCategory);
        // The destination reel has already been built. Release the temporary two-view portal
        // mode now; the portal's own busy guard protects the rest of its transition.
        portalTravel = false;
      }
      return;
    }
    setCategory(button === sitesButton ? 'sites' : 'movie');
  }, true);

  modeSwitch.addEventListener('keydown', event => {
    const current = event.target.closest('.mode');
    if (!current || !modeSwitch.contains(current)) return;
    const buttons = [sitesButton, appsButton, musicButton];
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

  const portalButton = document.getElementById('portal');
  if (portalButton) {
    portalButton.addEventListener('click', () => {
      if (portalTravel) return;
      portalSourceCategory = selectedCategory;
      portalTargetCategory = targetCategory(selectedCategory);
      portalTravel = true;
      portalCommitHandled = false;

      // The existing cinematic portal understands two underlying view modes. For Movie Apps,
      // temporarily present the site-mode marker so the portal chooses its app target, then feed
      // it the Music Apps catalog and switch categories at the portal's normal commit point.
      if (portalSourceCategory === 'movie') {
        sitesButton.classList.add('active');
        appsButton.classList.remove('active');
        musicButton.classList.remove('active');
      }
      updatePortalPresentation();
      clearTimeout(portalTravelTimer);
      portalTravelTimer = window.setTimeout(() => {
        portalTravel = false;
        portalCommitHandled = false;
        portalSourceCategory = null;
        portalTargetCategory = null;
        syncTabs();
        updatePortalPresentation();
      }, 3800);
    }, true);
  }

  // Re-rendering is still owned by the existing catalog. This observer only reapplies category
  // visibility and the correct empty state after its existing search/filter/sort render completes.
  const renderObserver = new MutationObserver(() => {
    updateCategoryView();
  });
  renderObserver.observe(sitesView, { childList: true, subtree: true });
  renderObserver.observe(appsView, { childList: true, subtree: true });

  const modeObserver = new MutationObserver(queueCategorySync);
  modeObserver.observe(modeSwitch, { attributes: true, attributeFilter: ['class'], subtree: true });

  const portalName = document.getElementById('portalName');
  const portalCount = document.getElementById('portalCount');
  if (portalName || portalCount) {
    const portalObserver = new MutationObserver(updatePortalPresentation);
    if (portalName) portalObserver.observe(portalName, { childList: true, characterData: true, subtree: true });
    if (portalCount) portalObserver.observe(portalCount, { childList: true, characterData: true, subtree: true });
  }

  const detailModal = document.getElementById('detailModal');
  const detailTags = document.getElementById('detailTags');
  const detailTitle = document.getElementById('detailTitle');
  function syncDetailCategory() {
    if (!detailModal || !detailModal.classList.contains('open') || !detailTags || !detailTitle) return;
    const title = detailTitle.textContent.trim().toLowerCase();
    const item = [...siteItems, ...allApps].find(entry => String(entry.name || '').toLowerCase() === title);
    if (!item) return;
    const categoryLabel = item.appType === 'music' ? 'Music App' : item.appType === 'movie' ? 'Movie App' : 'Website';
    detailTags.querySelectorAll('span').forEach(tag => {
      if (tag.textContent === 'Android app' || tag.textContent === 'Website') tag.textContent = categoryLabel;
    });
  }
  if (detailModal) {
    new MutationObserver(syncDetailCategory).observe(detailModal, { attributes: true, attributeFilter: ['class'] });
    if (detailTags) new MutationObserver(syncDetailCategory).observe(detailTags, { childList: true, subtree: true });
  }

  const search = document.getElementById('q');
  if (search) search.addEventListener('input', updateEmptyState);
  addEventListener('resize', positionThumb, { passive: true });
  addEventListener('orientationchange', positionThumb, { passive: true });

  updateCategoryView();
}
