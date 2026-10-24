/**
 * AT Protocol Services Index
 * Re-exports all AT Protocol service functions
 */

// Tracks
export {
	R4_COLLECTION,
	createTrack,
	listTracksByDid,
	getTrackByUri,
	updateTrackByUri,
	deleteTrackByUri,
	listAllTracksByDid,
	deleteAllTracks
} from './tracks.service'

// Favorites
export {
	R4_FAVORITE_COLLECTION,
	listR4FavoritesByDid,
	createR4Favorite,
	findR4FavoriteUri,
	deleteR4Favorite,
	hasR4Records,
	hasR4FavoriteRecord
} from './favorites.service'

// Profile
export {
	getR4Profile,
	setR4Profile
} from './profile.service'

// Channel
export {getChannel, updateChannel} from './channel.service'
export type {ChannelRecord, ChannelTheme} from './channel.service'

// Social
export {
	followActor,
	unfollowActor,
	findFollowUri,
	searchActors,
	getHandleByDid,
	getProfile,
	getProfiles
} from './social.service'

// Network (backend-free app view)
export {
	RELAY_SERVICE,
	listReposByCollection,
	listAllReposByCollection,
	getNetworkLatestTracks
} from './network.service'
export type {
	RadioActor,
	NetworkRadio,
	NetworkFeedOptions,
	NetworkFeedResult
} from './network.service'
