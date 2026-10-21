import React, { useState } from 'react';
import { Sparkles, ArrowRight, Film, Smartphone, Music, ShieldCheck } from 'lucide-react';
import { CategoryType } from '../types';

interface HeroProps {
  activeCategory: CategoryType;
  onSelectCategory: (cat: CategoryType) => void;
  counts: {
    sites: number;
    movie: number;
    music: number;
  };
}

export const Hero: React.FC<HeroProps> = ({ activeCategory, onSelectCategory, counts }) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const nextCategory: Record<CategoryType, CategoryType> = {
    sites: 'movie',
    movie: 'music',
    music: 'sites'
  };

  const categoryLabels: Record<CategoryType, string> = {
    sites: 'Websites',
    movie: 'Movie Apps',
    music: 'Music Apps'
  };

  const categoryIcons: Record<CategoryType, React.ReactNode> = {
    sites: <Film className="w-5 h-5 text-red-500" />,
    movie: <Smartphone className="w-5 h-5 text-amber-500" />,
    music: <Music className="w-5 h-5 text-cyan-400" />
  };

  const next = nextCategory[activeCategory];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <section className="relative pt-28 pb-12 px-4 md:px-8 text-center flex flex-col items-center justify-center min-h-[70vh]">
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/40 border border-red-500/20 text-red-400 text-xs font-semibold mb-4 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-red-500" />
          <span>Curated by Mahi · Hand-Picked Directory</span>
        </div>

        {/* Big Bebas Neue Title */}
        <h1 className="font-['Bebas_Neue'] text-6xl sm:text-8xl md:text-9xl tracking-tight text-white m-0 leading-none drop-shadow-2xl">
          <span className="bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
            STREAMCLOUD
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-base sm:text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto leading-relaxed font-normal">
          Explore curated movie and web-series websites, streaming apps, and music apps—all in one place.
        </p>

        {/* Pills metadata */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-neutral-300">
            <Film className="w-3.5 h-3.5 text-red-400" />
            {counts.sites} Websites
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-neutral-300">
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            {counts.movie} Movie Apps
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-neutral-300">
            <Music className="w-3.5 h-3.5 text-cyan-400" />
            {counts.music} Music Apps
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/30 border border-emerald-500/20 text-xs font-medium text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            No Ads Filter Available
          </span>
        </div>

        {/* Channel Jump Portal */}
        <div className="mt-8 flex flex-col items-center">
          <span className="text-[11px] uppercase tracking-widest text-neutral-400 font-semibold mb-2">
            Channel Jump Portal
          </span>

          <div
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={() => onSelectCategory(next)}
            style={{
              transform: `perspective(600px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
              transition: 'transform 0.15s ease-out'
            }}
            className="group cursor-pointer relative w-64 sm:w-72 p-4 rounded-2xl bg-gradient-to-br from-neutral-900/90 to-neutral-950/95 border border-white/15 hover:border-red-500/60 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:shadow-red-950/50 hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-red-500/10 group-hover:border-red-500/40 transition-colors">
                  {categoryIcons[next]}
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">
                    Next Collection
                  </div>
                  <div className="text-base font-bold text-white group-hover:text-red-400 transition-colors">
                    {categoryLabels[next]}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full group-hover:bg-red-600 group-hover:text-white transition-all">
                <span className="text-xs font-mono font-bold">[{counts[next]}]</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
            <div className="mt-2.5 text-[11px] text-neutral-400 text-left line-clamp-1">
              Click to jump instantly to {categoryLabels[next].toLowerCase()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
