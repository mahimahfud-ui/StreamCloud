import React from 'react';
import { History, X } from 'lucide-react';
import { RecentItem } from '../types';

interface RecentVisitedProps {
  items: RecentItem[];
  onClear: () => void;
  onSelect: (item: RecentItem) => void;
}

export const RecentVisited: React.FC<RecentVisitedProps> = ({ items, onClear, onSelect }) => {
  if (!items.length) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-8">
      <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 uppercase tracking-wider">
            <History className="w-3.5 h-3.5 text-red-500" />
            <span>Recently Visited</span>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-neutral-500 hover:text-red-400 transition-colors"
          >
            Clear History
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {items.map((it, idx) => (
            <a
              key={`${it.name}-${idx}`}
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onSelect(it)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 border border-white/5 hover:border-red-500/40 text-xs text-neutral-200 hover:text-white transition-all flex-shrink-0 group"
            >
              <span className="w-5 h-5 rounded-md bg-neutral-950 flex items-center justify-center font-bold text-[10px] text-red-400 border border-white/5 group-hover:border-red-500/50">
                {it.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="font-semibold">{it.name}</span>
              <span className="text-[10px] text-neutral-500">
                {it.type === 'site' ? 'Web' : it.type === 'music' ? 'Music' : 'App'}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};
