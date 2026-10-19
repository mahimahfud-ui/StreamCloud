export type CategoryType = 'sites' | 'movie' | 'music';

export type AdLevel = 0 | 1 | 2; // 0: No/minimal ads, 1: Some ads, 2: More ads

export interface CatalogItem {
  id?: string;
  name: string;
  url: string;
  downloadUrl?: string;
  downloadDirect?: boolean;
  domain: string;
  ads: AdLevel;
  pop: number;
  smooth: number;
  langs: number;
  new: boolean;
  desc: string;
  appType?: 'movie' | 'music';
  kind?: 'site' | 'app';
  color?: string;
  logoSources?: string[];
}

export type FilterOption = 'all' | 'new' | 'anime' | 'favourites';
export type AdFilterOption = 'all' | 'none' | 'less' | 'more';
export type SortOption = 'score' | 'popular' | 'newest' | 'name';
export type ViewMode = 'grid' | 'list';

export interface RecentItem {
  name: string;
  type: 'site' | 'movie' | 'music';
  url: string;
}

export interface LinkStatusEntry {
  status: 'up' | 'down' | 'unknown';
  http_status?: number;
  reason?: string;
  checked_at?: string;
}
