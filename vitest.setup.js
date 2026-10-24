import {beforeEach} from 'vitest'

// happy-dom ships a real localStorage; start every test from a clean one
// Node-environment tests (the indexer) have none
beforeEach(() => globalThis.localStorage?.clear())
