/**
 * Main R4 Service (Legacy Compatibility Layer)
 *
 * This file re-exports all functions from the new modular service files.
 * It maintains backward compatibility for existing imports.
 *
 * NEW CODE should import directly from the specific service modules:
 * - `./atproto/tracks.service` for track operations
 * - `./atproto/favorites.service` for favorite operations
 * - `./atproto/profile.service` for profile operations
 * - `./atproto/social.service` for social graph operations
 * - `./radio4000/sync.service` for Radio4000 sync operations
 */

// Re-export utility functions from atproto-client
export { getMyDid, resolveHandle } from '../utils/atproto-client'

// Re-export all AT Protocol services
export {
  // Collections
  R4_COLLECTION,
  R4_FAVORITE_COLLECTION,
  R4_PROFILE_COLLECTION,

  // Track operations
  createTrack,
  listTracksByDid,
  getTrackByUri,
  updateTrackByUri,
  deleteTrackByUri,
  listAllTracksByDid,
  deleteAllTracks,

  // Favorite operations
  listR4FavoritesByDid,
  createR4Favorite,
  findR4FavoriteUri,
  deleteR4Favorite,
  hasR4Records,
  hasR4FavoriteRecord,

  // Profile operations
  PROFILE_RKEY,
  getR4Profile,
  setR4Profile,

  // Social operations
  followActor,
  unfollowActor,
  findFollowUri,
  searchActors,
  getHandleByDid,
  getProfile,
  getProfiles,

  // Network (backend-free app view)
  RELAY_SERVICE,
  listReposByCollection,
  listAllReposByCollection,
  getNetworkLatestTracks,
} from './atproto'

// Re-export network types
export type {
  RadioActor,
  NetworkRadio,
  NetworkFeedOptions,
  NetworkFeedResult,
} from './atproto'

// Re-export Radio4000 sync services
export {
  R4_SYNC_COLLECTION,
  getR4SyncConfig,
  setR4SyncConfig,
  fetchRadio4000Channel,
  fetchRadio4000Tracks,
  importRadio4000Tracks,
} from './radio4000'

// Re-export types
export type { R4ProfileRecord } from '../types'
