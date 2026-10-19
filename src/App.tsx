import React, { useState, useEffect, useMemo } from 'react';
import {
  CategoryType,
  CatalogItem,
  FilterOption,
  AdFilterOption,
  SortOption,
  ViewMode,
  RecentItem
} from './types';
import { WEBSITES, MOVIE_APPS, MUSIC_APPS, calculateQualityScore, toSlug } from './data/catalog';
import { CinemaCanvas } from './components/CinemaCanvas';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { CatalogCard } from './components/CatalogCard';
import { DetailModal } from './components/DetailModal';
import { RecentVisited } from './components/RecentVisited';
import { Toast } from './components/Toast';
import { IntroScreen } from './components/IntroScreen';
import {
  Film,
  Smartphone,
  Music,
  LayoutGrid,
  List,
  RotateCcw,
  Heart,
  ChevronDown,
  Info,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export const App: React.FC = () => {
  // Intro screen visibility
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      return !sessionStorage.getItem('nf-intro');
    } catch {
      return false;
    }
  });

  // State
  const [activeCategory, setActiveCategory] = useState<CategoryType>('sites');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [adFilter, setAdFilter] = useState<AdFilterOption>('all');
  const [sortOption, setSortOption] = useState<SortOption>('score');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('streamcloud-view') as ViewMode) || 'grid';
    } catch {
      return 'grid';
    }
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<CatalogItem | null>(null);

  // Favorites state
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    const all = [...WEBSITES, ...MOVIE_APPS, ...MUSIC_APPS];
    all.forEach((item) => {
      try {
        const isFav = localStorage.getItem(`mahiflix-favorite:${toSlug(item.name)}`) === '1';
        if (isFav) map[toSlug(item.name)] = true;
      } catch {
        // ignore
      }
    });
    return map;
  });

  // Recent visited
  const [recentItems, setRecentItems] = useState<RecentItem[]>(() => {
    try {
      const saved = localStorage.getItem('streamcloud-recent-v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Switch View Mode
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('streamcloud-view', mode);
    } catch {
      // ignore
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = (item: CatalogItem) => {
    const slug = toSlug(item.name);
    const nextState = !favorites[slug];
    setFavorites((prev) => {
      const updated = { ...prev };
      if (nextState) {
        updated[slug] = true;
      } else {
        delete updated[slug];
      }
      return updated;
    });

    try {
      if (nextState) {
        localStorage.setItem(`mahiflix-favorite:${slug}`, '1');
        showToast(`Added ${item.name} to My List`);
      } else {
        localStorage.removeItem(`mahiflix-favorite:${slug}`);
        showToast(`Removed ${item.name} from My List`);
      }
    } catch {
      // ignore
    }
  };

  // Track visit to Recents
  const handleVisit = (item: CatalogItem) => {
    const type: 'site' | 'movie' | 'music' = item.appType === 'music'
      ? 'music'
      : item.appType === 'movie'
      ? 'movie'
      : 'site';

    setRecentItems((prev) => {
      const filtered = prev.filter((x) => !(x.name === item.name && x.type === type));
      const updated = [{ name: item.name, type, url: item.url }, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('streamcloud-recent-v1', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleRecentSelect = (item: RecentItem) => {
    setRecentItems((prev) => {
      const filtered = prev.filter((x) => !(x.name === item.name && x.type === item.type));
      const updated = [item, ...filtered];
      try {
        localStorage.setItem('streamcloud-recent-v1', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleClearRecent = () => {
    setRecentItems([]);
    try {
      localStorage.removeItem('streamcloud-recent-v1');
      showToast('Recently visited history cleared');
    } catch {
      // ignore
    }
  };

  const handleShare = (item: CatalogItem) => {
    const url = item.url;
    navigator.clipboard
      ?.writeText(url)
      .then(() => showToast(`Link for ${item.name} copied to clipboard!`))
      .catch(() => showToast(url));
  };

  // Deep linking via URL hash
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const all = [...WEBSITES, ...MOVIE_APPS, ...MUSIC_APPS];
    const match = all.find((x) => toSlug(x.name) === toSlug(hash));
    if (match) {
      if (match.appType === 'music') setActiveCategory('music');
      else if (match.appType === 'movie') setActiveCategory('movie');
      else setActiveCategory('sites');
      setSelectedDetailItem(match);
    }
  }, []);

  // Update hash when opening/closing modal
  const handleOpenDetail = (item: CatalogItem) => {
    setSelectedDetailItem(item);
    try {
      window.history.replaceState(null, '', `#${toSlug(item.name)}`);
    } catch {
      // ignore
    }
  };

  const handleCloseDetail = () => {
    setSelectedDetailItem(null);
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      // ignore
    }
  };

  // Filter & Sort Logic
  const filteredItems = useMemo(() => {
    let source: CatalogItem[] = [];
    if (activeCategory === 'sites') source = WEBSITES;
    else if (activeCategory === 'movie') source = MOVIE_APPS;
    else source = MUSIC_APPS;

    return source.filter((item) => {
      // Text search
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const text = `${item.name} ${item.domain} ${item.desc} ${item.url}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      // Ad filter
      if (adFilter === 'none' && item.ads !== 0) return false;
      if (adFilter === 'less' && item.ads !== 1) return false;
      if (adFilter === 'more' && item.ads !== 2) return false;

      // Filter chips
      if (activeFilter === 'new' && !item.new) return false;
      if (activeFilter === 'anime' && !/anime/i.test(`${item.name} ${item.desc}`)) return false;
      if (activeFilter === 'favourites' && !favorites[toSlug(item.name)]) return false;

      return true;
    }).sort((a, b) => {
      if (sortOption === 'popular') return b.pop - a.pop;
      if (sortOption === 'newest') return Number(b.new) - Number(a.new) || calculateQualityScore(b) - calculateQualityScore(a);
      if (sortOption === 'name') return a.name.localeCompare(b.name);
      return calculateQualityScore(b) - calculateQualityScore(a);
    });
  }, [activeCategory, searchQuery, adFilter, activeFilter, sortOption, favorites]);

  // Is any filter active?
  const hasActiveFilters =
    !!searchQuery.trim() ||
    adFilter !== 'all' ||
    activeFilter !== 'all' ||
    sortOption !== 'score';

  const handleResetFilters = () => {
    setSearchQuery('');
    setAdFilter('all');
    setActiveFilter('all');
    setSortOption('score');
    showToast('Filters reset to default');
  };

  const counts = {
    sites: WEBSITES.length,
    movie: MOVIE_APPS.length,
    music: MUSIC_APPS.length
  };

  const favoritesCount = Object.keys(favorites).length;

  return (
    <div className="min-h-screen text-white bg-[#0d0d0e] selection:bg-red-600 selection:text-white">
      {/* Intro Screen */}
      {showIntro && <IntroScreen onFinish={() => setShowIntro(false)} />}

      {/* Ambient Cinema Canvas */}
      <CinemaCanvas mood={activeCategory === 'sites' ? 0 : 1} />

      {/* Navigation */}
      <Navbar
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        favoritesCount={favoritesCount}
        onOpenFavorites={() => {
          setActiveFilter('favourites');
          const element = document.getElementById('catalog-content');
          element?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      <main className="relative z-10">
        {/* Hero Section */}
        <Hero
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          counts={counts}
        />

        {/* Recently Visited Bar */}
        <RecentVisited
          items={recentItems}
          onClear={handleClearRecent}
          onSelect={handleRecentSelect}
        />

        {/* Main Catalog Section */}
        <div id="catalog-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          {/* Category Tabs Switcher (Sticky Under Nav) */}
          <div className="sticky top-[68px] z-30 flex flex-col items-center justify-center my-6 py-2">
            <div className="flex items-center p-1.5 rounded-2xl bg-neutral-900/90 border border-white/10 backdrop-blur-xl shadow-2xl">
              <button
                type="button"
                onClick={() => setActiveCategory('sites')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all duration-300 ${
                  activeCategory === 'sites'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/40 scale-102'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Film className="w-4 h-4" />
                <span>Websites</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('movie')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all duration-300 ${
                  activeCategory === 'movie'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/40 scale-102'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Movie Apps</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('music')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all duration-300 ${
                  activeCategory === 'music'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/40 scale-102'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Music className="w-4 h-4" />
                <span>Music Apps</span>
              </button>
            </div>
          </div>

          {/* Catalog Controls: Filter Chips, Ad Level, Sort, Layout */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900/50 border border-white/10 backdrop-blur-md mb-8">
            {/* Filter Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeFilter === 'all'
                    ? 'bg-white text-black'
                    : 'bg-neutral-800/80 text-neutral-300 hover:text-white border border-white/5'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('new')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeFilter === 'new'
                    ? 'bg-white text-black'
                    : 'bg-neutral-800/80 text-neutral-300 hover:text-white border border-white/5'
                }`}
              >
                New Entries
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('anime')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeFilter === 'anime'
                    ? 'bg-white text-black'
                    : 'bg-neutral-800/80 text-neutral-300 hover:text-white border border-white/5'
                }`}
              >
                Anime
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('favourites')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeFilter === 'favourites'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-neutral-800/80 text-neutral-300 hover:text-white border border-white/5'
                }`}
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>My List ({favoritesCount})</span>
              </button>
            </div>

            {/* Selects: Ads, Sort, Layout, Reset */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
              {/* Ad filter */}
              <div className="flex items-center gap-2 bg-neutral-800/80 px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-[11px] text-neutral-400">Ads:</span>
                <select
                  value={adFilter}
                  onChange={(e) => setAdFilter(e.target.value as AdFilterOption)}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-neutral-900 text-white">All Ad Levels</option>
                  <option value="none" className="bg-neutral-900 text-white">No / Minimal Ads</option>
                  <option value="less" className="bg-neutral-900 text-white">Some Ads</option>
                  <option value="more" className="bg-neutral-900 text-white">Heavier Ads</option>
                </select>
              </div>

              {/* Sort Select */}
              <div className="flex items-center gap-2 bg-neutral-800/80 px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-[11px] text-neutral-400">Sort:</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="score" className="bg-neutral-900 text-white">Quality Score</option>
                  <option value="popular" className="bg-neutral-900 text-white">Most Popular</option>
                  <option value="newest" className="bg-neutral-900 text-white">Newest First</option>
                  <option value="name" className="bg-neutral-900 text-white">Name (A-Z)</option>
                </select>
              </div>

              {/* Layout Switcher */}
              <div className="flex items-center bg-neutral-800/80 p-0.5 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => handleViewModeChange('grid')}
                  title="Grid Layout"
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'grid' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange('list')}
                  title="List Layout"
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'list' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Reset button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  title="Reset all filters"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-900/50 hover:text-white text-xs font-semibold transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards Grid / List Display */}
          {filteredItems.length > 0 ? (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'
                  : 'flex flex-col gap-3'
              }
            >
              {filteredItems.map((item, index) => (
                <CatalogCard
                  key={`${item.name}-${index}`}
                  item={item}
                  rank={sortOption === 'score' && index < 10 ? index + 1 : undefined}
                  viewMode={viewMode}
                  isFavorite={!!favorites[toSlug(item.name)]}
                  onToggleFavorite={handleToggleFavorite}
                  onOpenDetail={handleOpenDetail}
                  onVisit={handleVisit}
                />
              ))}
            </div>
          ) : (
            <div className="py-24 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
                <Info className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">No listings found</h3>
              <p className="text-sm text-neutral-400 max-w-md mx-auto">
                {activeFilter === 'favourites'
                  ? 'You have not added any platforms to My List yet. Click the + button on any card to save it.'
                  : 'No platforms matched your current search and filters. Try adjusting your search query or reset the filters.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-colors"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Finale Section */}
        <section className="py-16 px-4 text-center border-t border-white/5 bg-gradient-to-b from-transparent to-neutral-950">
          <div className="max-w-md mx-auto flex flex-col items-center">
            <img
              src="/s-logo-v1.svg"
              alt="StreamCloud"
              className="w-16 h-16 object-contain mb-4 filter drop-shadow-[0_0_20px_rgba(229,9,20,0.5)]"
            />
            <h2 className="font-['Bebas_Neue'] text-4xl tracking-wider text-white">
              STREAMCLOUD
            </h2>
            <p className="text-xs text-neutral-400 mt-2 mb-6 leading-relaxed">
              Explore curated movie and web-series websites, streaming apps, and music apps—all in one place.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-5 py-2.5 rounded-xl bg-white text-black font-extrabold text-xs hover:bg-neutral-200 transition-colors"
              >
                Back to Top
              </button>
              <a
                href="https://www.instagram.com/mahimahfud/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-neutral-800 text-white font-extrabold text-xs hover:bg-neutral-700 transition-colors"
              >
                Contact Mahi
              </a>
            </div>
          </div>
        </section>

        {/* Footer & Legal Information */}
        <footer className="py-10 px-4 text-center border-t border-white/5 text-neutral-500 text-xs">
          <div className="flex items-center justify-center gap-6 mb-4">
            <a
              href="https://www.instagram.com/mahimahfud/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Instagram
            </a>
            <a href="#privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#disclaimer" className="hover:text-white transition-colors">
              Disclaimer
            </a>
          </div>

          <div className="mb-6">
            StreamCloud © {new Date().getFullYear()} · Curated by Mahi · Directory updated October 2026
          </div>

          <details className="max-w-2xl mx-auto text-left rounded-xl bg-neutral-950/70 p-4 border border-neutral-800 text-[11px] leading-relaxed">
            <summary className="cursor-pointer font-bold text-neutral-400 hover:text-white text-center pb-2">
              Privacy Policy &amp; Third-Party Content Disclaimer
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-neutral-800 mt-2">
              <section id="privacy">
                <h4 className="font-bold text-neutral-200 mb-1">Privacy Notice</h4>
                <p className="text-neutral-400">
                  StreamCloud does not require creating an account. Search and filter choices update locally, while favourites and personal ratings are saved exclusively in your own browser storage.
                </p>
              </section>
              <section id="disclaimer">
                <h4 className="font-bold text-neutral-200 mb-1">Third-Party Disclaimer</h4>
                <p className="text-neutral-400">
                  StreamCloud is an editorial directory, not a streaming host. It does not host, upload, or embed third-party videos. External sites and apps are operated by their respective owners. Check app permissions before installing APKs.
                </p>
              </section>
            </div>
          </details>
        </footer>
      </main>

      {/* Detail Modal */}
      <DetailModal
        item={selectedDetailItem}
        isOpen={!!selectedDetailItem}
        onClose={handleCloseDetail}
        isFavorite={selectedDetailItem ? !!favorites[toSlug(selectedDetailItem.name)] : false}
        onToggleFavorite={handleToggleFavorite}
        onShare={handleShare}
        onVisit={handleVisit}
      />

      {/* Floating Toast Notification */}
      <Toast message={toastMessage} />
    </div>
  );
};
export default App;
