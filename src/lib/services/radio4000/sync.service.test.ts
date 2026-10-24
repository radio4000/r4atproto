import {TID} from '@atproto/common-web'
import {describe, expect, it} from 'vitest'
import {tidFromDate} from './sync.service'

describe('tidFromDate', () => {
	const dates = [
		'2020-01-01T00:00:00.000Z',
		'2021-06-15T12:30:00.123Z',
		'2022-03-01T08:00:00.000Z',
		'2024-01-01T00:00:00.000Z'
	]

	it('makes valid TIDs that sort like their dates', () => {
		const tids = dates.map(tidFromDate)
		for (const tid of tids) expect(TID.is(tid)).toBe(true)
		expect([...tids].sort()).toEqual(tids)
	})

	it('keeps the timestamp', () => {
		const tid = TID.fromStr(tidFromDate(dates[1]))
		expect(tid.timestamp()).toBe(new Date(dates[1]).getTime() * 1000)
	})

	it('sorts imported tracks before tracks added today', () => {
		expect(tidFromDate(dates[3]) < TID.nextStr()).toBe(true)
	})
})
