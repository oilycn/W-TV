export interface ContentItem {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  backdropUrl?: string;
  cast?: string[];
  director?: string[];
  userRating?: number; // e.g., 7.5 / 10
  genres?: string[];
  releaseYear?: number;
  runtime?: string; // e.g., "2h 15m"
  type: 'movie' | 'tv_show';
  availableQualities?: string[]; // e.g., ["1080p", "720p", "4K"]
}

export interface SourceConfig {
  id: string; // Use uuid or simple timestamp for id
  name: string;
  url: string;
}
