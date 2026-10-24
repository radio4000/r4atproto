// Secrets, set with `wrangler secret put` (not in wrangler.toml)
interface Env {
	/** Bearer token for POST /admin/backfill */
	ADMIN_TOKEN?: string
}
