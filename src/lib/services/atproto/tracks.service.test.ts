import {describe, it, expect} from 'vitest'
import {getTrackByUri, updateTrackByUri, deleteTrackByUri} from './tracks.service'

describe('tracks.service', () => {
	describe('URI validation', () => {
		it('should throw error when deleteTrackByUri called with undefined', async () => {
			await expect(deleteTrackByUri(undefined as unknown as string)).rejects.toThrow()
		})

		it('should throw error when deleteTrackByUri called with null', async () => {
			await expect(deleteTrackByUri(null as unknown as string)).rejects.toThrow()
		})

		it('should throw error when deleteTrackByUri called with empty string', async () => {
			await expect(deleteTrackByUri('')).rejects.toThrow()
		})

		it('should throw error for invalid URI format', async () => {
			await expect(deleteTrackByUri('invalid-uri')).rejects.toThrow()
		})

		it('should throw error for incomplete URI', async () => {
			await expect(deleteTrackByUri('at://did:plc:abc/collection')).rejects.toThrow()
		})

		it('should throw error when getTrackByUri called with empty URI', async () => {
			await expect(getTrackByUri('')).rejects.toThrow()
		})

		it('should throw error when updateTrackByUri called with empty URI', async () => {
			await expect(updateTrackByUri('', {title: 'New Title'})).rejects.toThrow()
		})
	})
})
