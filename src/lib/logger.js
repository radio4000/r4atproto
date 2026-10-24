// Same API as r4-svelte's logger (logger.ns('name').seal()), on the console.
// Debug and info in dev; warnings and errors always.
const dev = import.meta.env?.DEV

/** @param {string} [namespace] */
function create(namespace) {
	const prefix = namespace ? `r4.${namespace}` : 'r4'
	const quiet = () => {}
	return {
		debug: dev ? (...args) => console.debug(prefix, ...args) : quiet,
		log: dev ? (...args) => console.log(prefix, ...args) : quiet,
		info: dev ? (...args) => console.info(prefix, ...args) : quiet,
		warn: (...args) => console.warn(prefix, ...args),
		error: (...args) => console.error(prefix, ...args),
		/** @param {string} name */
		ns: (name) => ({seal: () => create(name)}),
		seal() {
			return this
		}
	}
}

export const logger = create()
