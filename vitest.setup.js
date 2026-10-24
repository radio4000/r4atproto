import {beforeEach} from 'vitest'

// happy-dom ships a real localStorage; start every test from a clean one
beforeEach(() => localStorage.clear())
