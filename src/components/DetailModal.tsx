import React, { useState, useEffect } from 'react';
import { X, Star, Share2, Plus, Check, ExternalLink, Download, ShieldCheck, Film, Smartphone, Music } from 'lucide-react';
import { CatalogItem } from '../types';
import {
  calculateQualityScore,
  getItemInitials,
  getLogoCandidateList,
  toSlug
} from '../data/catalog';

interface DetailModalProps {
  item: CatalogItem | null;
  isOpen: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (item: CatalogItem) => void;
  onShare: (item: CatalogItem) => void;
  onVisit: (item: CatalogItem) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  item,
  isOpen,
  onClose,
  isFavorite,
  onToggleFavorite,
  onShare,
  onVisit
}) => {
  if (!isOpen || !item) return null;

  const slug = toSlug(item.name);
  const ratingKey = `mahiflix-rating:${slug}`;
  const [userRating, setUserRating] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(ratingKey) || 0);
    } catch {
      return 0;
    }
  });

  const [hoverRating, setHoverRating] = useState<number>(0);
  const logoCandidates = getLogoCandidateList(item);
  const [logoIndex, setLogoIndex] = useState(0);
  const [useInitials, setUseInitials] = useState(false);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(ratingKey) || 0);
      setUserRating(saved);
    } catch {
      setUserRating(0);
    }
    setLogoIndex(0);
    setUseInitials(false);
  }, [item.name]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleRate = (rating: number) => {
    setUserRating(rating);
    try {
      localStorage.setItem(ratingKey, String(rating));
    } catch {
      // ignore
    }
  };

  const handleLogoError = () => {
    if (logoIndex + 1 < logoCandidates.length) {
      setLogoIndex(logoIndex + 1);
    } else {
      setUseInitials(true);
    }
  };

  const score = Math.round(calculateQualityScore(item));
  const isApp = item.kind === 'app' || !!item.appType;
  const isMusic = item.appType === 'music';

  const adLabel =
    item.ads === 0
      ? 'No / Minimal Ads'
      : item.ads === 1
      ? 'Some Ads'
      : 'More / Heavier Ads';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Scrim */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-neutral-900 border border-neutral-700 p-6 md:p-8 shadow-2xl text-left">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Heading */}
        <div className="flex items-center gap-4 pr-8">
          <div className="w-16 h-16 rounded-xl bg-black border border-neutral-800 flex items-center justify-center overflow-hidden p-2 flex-shrink-0 shadow">
            {useInitials ? (
              <span className="font-['Bebas_Neue'] text-3xl text-white">
                {getItemInitials(item.name)}
              </span>
            ) : (
              <img
                src={logoCandidates[logoIndex]}
                alt={`${item.name} logo`}
                onError={handleLogoError}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-bold text-red-400 mb-1">
              {isMusic ? 'MUSIC APP' : isApp ? 'MOVIE APP' : 'STREAMING WEBSITE'}
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight truncate">
              {item.name}
            </h2>
            <div className="text-xs text-neutral-400 mt-0.5 truncate">{item.domain}</div>
          </div>
        </div>

        {/* Description */}
        <p className="mt-5 text-sm text-neutral-300 leading-relaxed font-normal">
          {item.desc || 'Curated entry in the StreamCloud catalogue.'}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-4">
          {item.new && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-600/30 text-red-300 border border-red-500/40">
              New Entry
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
            {isApp ? 'Android App' : 'Website'}
          </span>
          {/anime/i.test(`${item.name} ${item.desc}`) && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-950/60 text-purple-300 border border-purple-500/30">
              Anime Support
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
            {item.domain}
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 my-5">
          <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center">
            <span className="text-[10px] text-neutral-400 block mb-1">Mahi Score</span>
            <strong className="text-base text-emerald-400 font-bold">{score}/100</strong>
          </div>
          <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center">
            <span className="text-[10px] text-neutral-400 block mb-1">Ad Frequency</span>
            <strong className="text-xs text-neutral-200 font-semibold">{adLabel}</strong>
          </div>
          <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center">
            <span className="text-[10px] text-neutral-400 block mb-1">Status</span>
            <strong className="text-xs text-emerald-400 font-semibold">Active Directory</strong>
          </div>
        </div>

        {/* Star Rating Widget */}
        <div className="py-4 border-y border-neutral-800 my-4">
          <label className="block text-xs font-bold text-neutral-300 mb-2">
            Your Private Rating
          </label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (hoverRating || userRating) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRate(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-6 h-6 ${
                      active
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-neutral-600 hover:text-neutral-500'
                    } transition-colors`}
                  />
                </button>
              );
            })}
          </div>
          <span className="block mt-2 text-[11px] text-neutral-400">
            {userRating > 0
              ? `Your rating: ${userRating}/5 · saved in this browser.`
              : 'Rate this platform for your personal record (saved in your browser).'}
          </span>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-wrap items-center gap-2.5 mt-5">
          {isApp ? (
            <>
              <a
                href={item.downloadUrl || item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onVisit(item)}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow min-w-[140px]"
              >
                <Download className="w-4 h-4" />
                <span>{item.downloadDirect === false ? 'Official Download' : 'Download APK'}</span>
              </a>
              {item.url && item.url !== item.downloadUrl && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onVisit(item)}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700 text-xs font-bold transition-colors"
                  title="Visit Website"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Website</span>
                </a>
              )}
            </>
          ) : (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onVisit(item)}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-colors shadow"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Visit Site</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => onToggleFavorite(item)}
            className={`inline-flex items-center gap-1.5 py-2.5 px-3.5 rounded-xl border text-xs font-bold transition-colors ${
              isFavorite
                ? 'bg-red-600/20 border-red-500/50 text-red-400'
                : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700'
            }`}
          >
            {isFavorite ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isFavorite ? 'Saved in My List' : 'Add to My List'}</span>
          </button>

          <button
            type="button"
            onClick={() => onShare(item)}
            className="inline-flex items-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700 text-xs font-bold transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>
  );
};
