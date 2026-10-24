/**
 * Type tests to ensure type safety of our application
 */

import type {AtpSessionData} from '@atproto/api'
import type {R4ProfileRecord} from './services/r4-service'
import type {Track} from './stores/tracks-db'

// Test R4ProfileRecord type
const testProfile: R4ProfileRecord = {
	mode: 'auto',
	lightBackground: '0 0% 100%',
	lightForeground: '240 10% 3.9%',
	lightAccent: '262 83% 58%',
	darkBackground: '240 10% 3.9%',
	darkForeground: '0 0% 98%',
	darkAccent: '262 83% 58%'
}

// Test that R4ProfileRecord has required properties
const hasRequiredProps: Required<
	Pick<
		R4ProfileRecord,
		| 'mode'
		| 'lightBackground'
		| 'lightForeground'
		| 'lightAccent'
		| 'darkBackground'
		| 'darkForeground'
		| 'darkAccent'
	>
> = {
	mode: testProfile.mode,
	lightBackground: testProfile.lightBackground,
	lightForeground: testProfile.lightForeground,
	lightAccent: testProfile.lightAccent,
	darkBackground: testProfile.darkBackground,
	darkForeground: testProfile.darkForeground,
	darkAccent: testProfile.darkAccent
}

// Test Track type
const testTrack: Track = {
	uri: 'at://test',
	url: 'https://example.com/track',
	title: 'Test Track',
	cid: 'test-cid',
	rkey: 'test-key',
	description: 'A test track',
	authorDid: 'did:web:test.example.com',
	created_at: '2023-01-01T00:00:00.000Z',
	discogs_url: undefined
}

// Test that Track has required properties
const trackWithRequired: Pick<Track, 'uri' | 'url' | 'title'> = {
	uri: testTrack.uri,
	url: testTrack.url,
	title: testTrack.title
}

console.log('Type tests passed')
