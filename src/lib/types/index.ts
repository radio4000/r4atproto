/**
 * Shared Type Definitions
 * Central location for all domain types used across the application
 */

// AT Protocol base types
export interface AtUri {
  uri: string;
  collection: string;
  rkey: string;
}

// Track types
// Matches Radio4000.com schema - uses snake_case for consistency
export interface Track {
  uri: string;
  cid?: string;
  rkey?: string;
  url: string;
  title: string;
  description?: string;
  discogs_url?: string; // snake_case to match Radio4000
  media_error?: string; // snake_case - stores playback error message if any
  duration_seconds?: number; // snake_case - media duration in seconds (if known)
  r4SupabaseId?: string;
  created_at?: string; // snake_case to match Radio4000
  updated_at?: string; // snake_case to match Radio4000
  authorDid?: string; // camelCase OK - this is internal to our app
}

export interface CreateTrackParams {
  url: string;
  title: string;
  description?: string;
  discogs_url?: string;
  r4SupabaseId?: string;
}

export interface UpdateTrackParams {
  url?: string;
  title?: string;
  description?: string;
  discogs_url?: string;
  media_error?: string;
  duration_seconds?: number;
}

export interface ListTracksOptions {
  cursor?: string;
  limit?: number;
  reverse?: boolean; // Default false (oldest first), true for newest first
}

export interface ListTracksResult {
  tracks: Track[];
  cursor?: string;
}

// AT Protocol record types
export interface AtProtoRecord<T = Record<string, unknown>> {
  uri: string;
  cid: string;
  value: T;
}

export interface ListRecordsResponse<T = Record<string, unknown>> {
  records: AtProtoRecord<T>[];
  cursor?: string;
}

// Actor/Profile types
export interface Actor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
}

// Favorite types
export interface R4FavoriteRecord {
  uri: string;
  cid?: string;
  rkey?: string;
  subject: string; // DID of favorited user
  createdAt?: string;
}

export interface ListR4FavoriteOptions {
  cursor?: string;
  limit?: number;
}

export interface ListR4FavoriteResult {
  favorites: R4FavoriteRecord[];
  cursor?: string;
}

// Profile/Theme types
export interface R4ProfileRecord {
  uri?: string;
  cid?: string;
  mode: 'light' | 'dark' | 'auto';
  lightBackground: string;
  lightForeground: string;
  lightAccent: string;
  darkBackground: string;
  darkForeground: string;
  darkAccent: string;
  createdAt?: string;
  updatedAt?: string;
}

// Sync types
export interface R4SyncRecord {
  uri?: string;
  cid?: string;
  apiEndpoint: string;
  apiKey: string;
  channelSlug: string;
  createdAt?: string;
  updatedAt?: string;
}

// Radio4000 legacy types
export interface Radio4000Track {
  id: string;
  url: string;
  title: string;
  description?: string | null;
  discogs_url?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Radio4000Channel {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  created: string;
  updated?: string;
}

export interface Radio4000ChannelData {
  channel: Radio4000Channel;
  tracks: Radio4000Track[];
}

// Relationship types
export interface Relationship {
  did: string;
  following?: string; // URI of follow record
  followedBy?: string; // URI of follower's follow record
}

export interface RelationshipsResponse {
  relationships?: Relationship[];
}

// OAuth types
export interface OAuthOptions {
  state?: string;
  signal?: AbortSignal;
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  redirect_uri?: string;
  authorization_details?: AuthorizationDetail[];
}

export interface AuthorizationDetail {
  type: string;
  actions?: string[];
  identifier?: string;
}

// Service response types
export interface ServiceResponse<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
}

// Generic paginated response
export interface PaginatedResponse<T> {
  items: T[];
  cursor?: string;
  total?: number;
}
