import {describe, it, expect, vi, beforeEach} from 'vitest'

// Define proper types for the mock
interface MockAgent {
	accountDid: string
	com: {
		atproto: {
			repo: {
				listRecords: any
				applyWrites: any
				createRecord: any
				deleteRecord: any
				putRecord: any
				getRecord: any
				_client: {}
			}
		}
	}
	app: {
		bsky: {
			graph: {
				getFollows: any
				getFollowers: any
				getRelationships: any
				follow: any
				unfollow: any
			}
		}
	}
}

// Mock the bsky-oauth module
vi.mock('./bsky-oauth.js', () => ({
	bskyOAuth: {agent: null}
}))

import {bskyOAuth} from './bsky-oauth.js'
import {findFollowUri} from './r4-service.js'

describe('r4-service follow helpers', () => {
	beforeEach(() => {
		// Properly mock the entire agent with required properties
		const mockAgent: MockAgent = {
			accountDid: 'did:example:me',
			com: {
				atproto: {
					repo: {
						listRecords: vi.fn().mockResolvedValue({
							data: {
								records: [
									{
										uri: 'at://did:example:me/app.bsky.graph.follow/123',
										value: {subject: 'did:plc:target'}
									}
								]
							}
						}),
						applyWrites: vi.fn().mockResolvedValue({}),
						createRecord: vi.fn().mockResolvedValue({}),
						deleteRecord: vi.fn().mockResolvedValue({}),
						putRecord: vi.fn().mockResolvedValue({}),
						getRecord: vi.fn().mockResolvedValue({}),
						_client: {}
					}
				}
			},
			app: {
				bsky: {
					graph: {
						getFollows: vi.fn(),
						getFollowers: vi.fn(),
						getRelationships: vi.fn(),
						follow: vi.fn(),
						unfollow: vi.fn()
					}
				}
			}
		}
		bskyOAuth.agent = mockAgent as any
	})

	it('findFollowUri returns record uri for subject', async () => {
		const uri = await findFollowUri('did:plc:target')
		expect(uri).toContain('app.bsky.graph.follow')
	})
})

// Additional tests to improve coverage
describe('r4-service integration', () => {
	it('should handle non-existent follows gracefully', async () => {
		// Change the mock to return no records
		;(bskyOAuth.agent as any).com.atproto.repo.listRecords = vi.fn().mockResolvedValue({
			data: {
				records: []
			}
		})

		const uri = await findFollowUri('did:nonexistent')
		expect(uri).toBeNull()
	})
})
