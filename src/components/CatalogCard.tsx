import React, { useState } from 'react';
import { Play, Plus, Check, Info, Download, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';
import { CatalogItem, ViewMode } from '../types';
import {
  calculateQualityScore,
  getItemHue,
  getItemInitials,
  getLogoCandidateList
} from '../data/catalog';

interface CatalogCardProps {
  item: CatalogItem;
  rank?: number;
  viewMode: ViewMode;
  isFavorite: boolean;
  onToggleFavorite: (item: CatalogItem) => void;
  onOpenDetail: (item: CatalogItem) => void;
  onVisit: (item: CatalogItem) => void;
}

export const CatalogCard: React.FC<CatalogCardProps> = ({
  item,
  rank,
  viewMode,
  isFavorite,
  onToggleFavorite,
  onOpenDetail,
  onVisit
}) => {
  const logoCandidates = getLogoCandidateList(item);
  const [logoIndex, setLogoIndex] = useState(0);
  const [useInitials, setUseInitials] = useState(false);

  const score = Math.round(calculateQualityScore(item));
  const isApp = item.kind === 'app' || !!item.appType;
  const isMusic = item.appType === 'music';
  const hue = getItemHue(item.name);

  const handleLogoError = () => {
    if (logoIndex + 1 < logoCandidates.length) {
      setLogoIndex(logoIndex + 1);
    } else {
      setUseInitials(true);
    }
  };

  const adLabel = item.ads === 0 ? 'NO AD' : item.ads === 1 ? 'LESS AD' : 'MORE ADS';
  const adColorClass =
    item.ads === 0
      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
      : item.ads === 1
      ? 'bg-amber-950/80 text-amber-300 border-amber-500/30'
      : 'bg-red-950/80 text-red-400 border-red-500/30';

  // -------------------------------------------------------------
  // LIST VIEW LAYOUT
  // -------------------------------------------------------------
  if (viewMode === 'list') {
    return (
      <div className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-900/70 border border-white/10 hover:border-red-500/40 hover:bg-neutral-900/90 transition-all duration-200">
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          {/* Logo / Initials */}
          <div className="w-12 h-12 rounded-xl bg-black border border-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden p-1 shadow">
            {useInitials ? (
              <span className="font-['Bebas_Neue'] text-lg text-white font-bold">
                {getItemInitials(item.name)}
              </span>
            ) : (
              <img
                src={logoCandidates[logoIndex]}
                alt={`${item.name} logo`}
                onError={handleLogoError}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {rank && (
                <span className="font-['Bebas_Neue'] text-amber-400 font-bold text-sm">
                  #{rank}
                </span>
              )}
              <h3 className="font-bold text-white text-base truncate group-hover:text-red-400 transition-colors">
                {item.name}
              </h3>
              {item.new && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-600 text-white tracking-wider">
                  NEW
                </span>
              )}
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${adColorClass}`}>
                {adLabel}
              </span>
            </div>

            <p className="text-xs text-neutral-400 truncate mt-0.5">{item.desc}</p>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-neutral-400">
              <span className="text-neutral-300 font-medium">Domain: {item.domain}</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">Mahi Score: {score}/100</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => onToggleFavorite(item)}
            title={isFavorite ? 'Remove from My List' : 'Add to My List'}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${
              isFavorite
                ? 'bg-red-600/20 border-red-500/50 text-red-400'
                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {isFavorite ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => onOpenDetail(item)}
            title="View Details"
            className="p-2 rounded-lg border border-white/10 bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>

          {isApp ? (
            <div className="flex items-center gap-2">
              <a
                href={item.downloadUrl || item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onVisit(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{item.downloadDirect === false ? 'Official Download' : 'Download APK'}</span>
              </a>
              {!isMusic && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onVisit(item)}
                  className="p-2 rounded-lg border border-white/10 bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Visit Website"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          ) : (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onVisit(item)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-extrabold transition-colors shadow"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Visit Site</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // GRID VIEW: APP CARD (Movie / Music App)
  // -------------------------------------------------------------
  if (isApp) {
    const accentBorder = isMusic
      ? 'hover:border-cyan-500/50 hover:shadow-cyan-950/40'
      : 'hover:border-red-500/50 hover:shadow-red-950/40';

    return (
      <article
        className={`relative flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-b from-neutral-900/90 to-neutral-950/95 border border-white/10 ${accentBorder} shadow-xl hover:-translate-y-1.5 transition-all duration-300 group`}
      >
        <div>
          {/* Card Top: Icon + App Badge + Favorite */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center p-2 shadow-inner overflow-hidden">
              {useInitials ? (
                <span className="font-['Bebas_Neue'] text-2xl text-white">
                  {getItemInitials(item.name)}
                </span>
              ) : (
                <img
                  src={logoCandidates[logoIndex]}
                  alt={`${item.name} icon`}
                  onError={handleLogoError}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                  isMusic
                    ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-500/30'
                    : 'bg-red-950/80 text-red-400 border border-red-500/30'
                }`}
              >
                {isMusic ? 'MUSIC APP' : 'MOVIE APP'}
              </span>

              <button
                type="button"
                onClick={() => onToggleFavorite(item)}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                  isFavorite
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'bg-neutral-800 border-white/10 text-neutral-400 hover:text-white'
                }`}
              >
                {isFavorite ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Title & Description */}
          <div className="flex items-baseline justify-between gap-2">
            <h3
              onClick={() => onOpenDetail(item)}
              className="font-bold text-white text-lg tracking-tight hover:text-red-400 cursor-pointer transition-colors"
            >
              {item.name}
            </h3>
            {rank && <span className="font-['Bebas_Neue'] text-neutral-500 text-sm">#{rank}</span>}
          </div>

          <p className="mt-1.5 text-xs text-neutral-400 line-clamp-2 leading-relaxed min-h-[32px]">
            {item.desc}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {item.new && (
              <span className="px-2 py-0.5 rounded text-[9px] font-black bg-red-600 text-white tracking-wider">
                NEW
              </span>
            )}
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${adColorClass}`}>
              {adLabel}
            </span>
            <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-white/5 border border-white/10 text-neutral-400">
              {item.domain}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 pt-3.5 border-t border-white/5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>Score: {score}/100</span>
            <button
              type="button"
              onClick={() => onOpenDetail(item)}
              className="text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <Info className="w-3.5 h-3.5" /> Details
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={item.downloadUrl || item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onVisit(item)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold shadow-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{item.downloadDirect === false ? 'Official Download' : 'Download APK'}</span>
            </a>

            {!isMusic && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onVisit(item)}
                title="Visit Website"
                className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </article>
    );
  }

  // -------------------------------------------------------------
  // GRID VIEW: WEBSITE LOGO CARD
  // -------------------------------------------------------------
  const bgGradient = `linear-gradient(140deg, hsl(${hue} 50% 18%), #0d0d0e)`;

  return (
    <div
      className="group relative aspect-square rounded-2xl p-4 flex flex-col items-center justify-center border border-white/10 hover:border-red-500/60 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-black/80 overflow-hidden cursor-pointer"
      style={{ background: bgGradient }}
      onClick={() => onOpenDetail(item)}
    >
      {/* Top 10 Stylized Number */}
      {rank && (
        <span className="absolute -left-2 -bottom-6 font-['Bebas_Neue'] text-8xl text-neutral-800/40 select-none pointer-events-none group-hover:text-red-500/10 transition-colors">
          {rank}
        </span>
      )}

      {/* Badges on Top Corners */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1">
        {item.new && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-600 text-white tracking-wider shadow">
            NEW
          </span>
        )}
      </div>

      <div className="absolute top-3 right-3 z-10">
        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border shadow ${adColorClass}`}>
          {adLabel}
        </span>
      </div>

      {/* Main Logo */}
      <div className="w-3/5 h-3/5 rounded-2xl bg-black/90 p-3 flex items-center justify-center border border-white/10 shadow-2xl group-hover:scale-105 group-hover:border-red-500/30 transition-all duration-300">
        {useInitials ? (
          <span className="font-['Bebas_Neue'] text-4xl text-white">
            {getItemInitials(item.name)}
          </span>
        ) : (
          <img
            src={logoCandidates[logoIndex]}
            alt={`${item.name} logo`}
            onError={handleLogoError}
            className="w-full h-full object-contain filter drop-shadow"
            loading="lazy"
          />
        )}
      </div>

      {/* Caption at bottom */}
      <div className="mt-3 text-center z-10">
        <span className="font-bold text-white text-sm tracking-wide block group-hover:text-red-400 transition-colors">
          {item.name}
        </span>
        <span className="text-[11px] text-neutral-400">{item.domain}</span>
      </div>

      {/* Hover Reveal Card Overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 p-4 bg-neutral-950/95 border-t border-white/15 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 z-20 flex flex-col gap-2"
      >
        <div className="flex items-center justify-between">
          <b className="text-white text-xs font-bold">{item.name}</b>
          <span className="text-[10px] text-emerald-400 font-semibold">{score}/100</span>
        </div>

        <p className="text-[11px] text-neutral-300 line-clamp-1">{item.desc}</p>

        <div className="flex items-center gap-2 pt-1">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onVisit(item)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-colors"
          >
            <Play className="w-3 h-3 fill-current" /> Visit
          </a>

          <button
            type="button"
            onClick={() => onToggleFavorite(item)}
            title={isFavorite ? 'Remove from My List' : 'Add to My List'}
            className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              isFavorite
                ? 'bg-red-600 border-red-500 text-white'
                : 'bg-white/10 border-white/10 text-neutral-300 hover:text-white'
            }`}
          >
            {isFavorite ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => onOpenDetail(item)}
            title="Details"
            className="p-1.5 rounded-lg border border-white/10 bg-white/10 text-neutral-300 hover:text-white transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
