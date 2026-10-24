import {describe, it, expect, beforeEach} from 'vitest'
import {
	profilesCollection,
	getProfileFromCache,
	updateProfileCache,
	clearProfileCache,
	clearAllProfiles
} from './profiles-db'
import type {Profile} from './profiles-db'

describe('profiles-db', () => {
	const mockProfile: Profile = {
		did: 'did:plc:test123',
		handle: 'testuser',
		displayName: 'Test User',
		avatar: 'https://example.com/avatar.jpg',
		description: 'Test description',
		indexedAt: new Date().toISOString(),
		viewer: {},
		labels: []
	}

	beforeEach(() => {
		// Clear all profiles before each test
		clearAllProfiles()
	})

	describe('Collection operations', () => {
		it('should insert profile into collection', () => {
			profilesCollection.insert(mockProfile)

			const allProfiles = profilesCollection.toArray
			expect(allProfiles).toHaveLength(1)
			expect(allProfiles[0]).toMatchObject(mockProfile)
		})

		it('should get profile from collection by DID', () => {
			profilesCollection.insert(mockProfile)

			const result = profilesCollection.get('did:plc:test123')
			expect(result).toMatchObject(mockProfile)
		})

		it('should update profile in collection', () => {
			profilesCollection.insert(mockProfile)

			profilesCollection.update('did:plc:test123', (draft) => {
				draft.displayName = 'Updated Name'
			})

			const result = profilesCollection.get('did:plc:test123')
			expect(result?.displayName).toBe('Updated Name')
			expect(result?.handle).toBe('testuser')
		})

		it('should delete profile from collection', () => {
			profilesCollection.insert(mockProfile)
			expect(profilesCollection.toArray).toHaveLength(1)

			profilesCollection.delete('did:plc:test123')
			expect(profilesCollection.toArray).toHaveLength(0)
		})
	})

	describe('getProfileFromCache', () => {
		beforeEach(() => {
			profilesCollection.insert(mockProfile)
		})

		it('should get profile by DID', () => {
			const result = getProfileFromCache('did:plc:test123')
			expect(result).toMatchObject(mockProfile)
		})

		it('should get profile by handle', () => {
			const result = getProfileFromCache('testuser')
			expect(result).toMatchObject(mockProfile)
		})

		it('should get profile by @handle', () => {
			const result = getProfileFromCache('@testuser')
			expect(result).toMatchObject(mockProfile)
		})

		it('should return null for non-existent profile', () => {
			const result = getProfileFromCache('nonexistent')
			expect(result).toBeNull()
		})

		it('should return null for empty input', () => {
			const result = getProfileFromCache('')
			expect(result).toBeNull()
		})
	})

	describe('updateProfileCache', () => {
		beforeEach(() => {
			profilesCollection.insert(mockProfile)
		})

		it('should update profile in cache', () => {
			updateProfileCache('did:plc:test123', {
				displayName: 'Updated Name'
			})

			const cached = getProfileFromCache('did:plc:test123')
			expect(cached?.displayName).toBe('Updated Name')
			expect(cached?.handle).toBe('testuser') // Other fields unchanged
		})

		it('should not error on non-existent profile', () => {
			expect(() => {
				updateProfileCache('did:plc:nonexistent', {
					displayName: 'Test'
				})
			}).not.toThrow()
		})
	})

	describe('clearProfileCache', () => {
		beforeEach(() => {
			profilesCollection.insert(mockProfile)
		})

		it('should remove profile from cache', () => {
			clearProfileCache('did:plc:test123')

			const cached = getProfileFromCache('did:plc:test123')
			expect(cached).toBeNull()
		})

		it('should not error on non-existent profile', () => {
			expect(() => {
				clearProfileCache('did:plc:nonexistent')
			}).not.toThrow()
		})
	})

	describe('clearAllProfiles', () => {
		it('should clear all profiles from cache', () => {
			const profile1 = {...mockProfile, did: 'did:plc:user1', handle: 'user1'}
			const profile2 = {...mockProfile, did: 'did:plc:user2', handle: 'user2'}

			profilesCollection.insert(profile1)
			profilesCollection.insert(profile2)

			expect(getProfileFromCache('user1')).not.toBeNull()
			expect(getProfileFromCache('user2')).not.toBeNull()

			clearAllProfiles()

			expect(getProfileFromCache('user1')).toBeNull()
			expect(getProfileFromCache('user2')).toBeNull()
		})

		it('should handle empty collection', () => {
			expect(() => clearAllProfiles()).not.toThrow()
		})
	})
})
