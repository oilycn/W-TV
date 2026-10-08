
export interface ContentItem {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  backdropUrl?: string;
  cast?: string[];
  director?: string[];
  userRating?: number; // e.g., 7.5 / 10
  genres?: string[]; // From type_name of the item itself
  releaseYear?: number;
  runtime?: string; // e.g., "2h 15m"
  remarks?: string; // e.g., "更新至24集" or "HD"
  type: 'movie' | 'tv_show';
  availableQualities?: string[]; // e.g., ["1080p", "720p", "4K"]
  playbackSources?: PlaybackSourceGroup[];
}

export interface PlaybackURL {
  name: string; // e.g., "第1集" or "高清"
  url: string;
}

export interface PlaybackSourceGroup {
  sourceName: string; // e.g., "m3u8", "线路1"
  urls: PlaybackURL[];
}

export interface SourceConfig {
  id: string; // Use uuid or simple timestamp for id
  name: string;
  url: string; // This is the base URL for the API source or JS rule URL
  type?: 'api' | 'js' | 'rule'; // Type of source: standard CMS API, JS spider rule, or legacy rule
  enabled?: boolean;
}

export interface ApiCategory {
  id: string; // from type_id
  name: string; // from type_name
}

export interface PaginatedContentResponse {
  items: ContentItem[];
  page: number;
  pageCount: number; // Total number of pages
  limit: number; // Items per page
  total: number; // Total number of items across all pages for this query
}

export interface RawSubscriptionSourceItem {
  key?: string;
  name?: string;
  type?: number | string; // 0 for player, 1 / 'api' for VOD source, 3 / 'js' for spider rule
  api?: string;
  searchable?: number; // 0 or 1
  quickSearch?: number; // 0 or 1
  changeable?: number; // 0 or 1
  filterable?: number; // 0 or 1
}

export interface HistoryEntry {
  item: ContentItem;
  watchedAt: number; // timestamp
  sourceId: string;
  episodeName: string;
  sourceName: string;
  episodeUrl: string;
}
