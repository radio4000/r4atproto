<script lang="ts">
	import {
		followActor,
		unfollowActor,
		findFollowUri,
		createR4Favorite,
		deleteR4Favorite
	} from '#lib/services/r4-service.js'
	import {session} from '#lib/state/session.js'
	import {Button} from '#lib/components/ui/button/index.js'
	import {Star} from 'lucide-svelte'
	import {locale, translate} from '#lib/i18n/index.js'
	const {actorDid = ''} = $props()
	let followUri = $state(null)
	let error = $state('')
	let pending = $state(false)
	const t = (key, vars = {}) => translate($locale, key, vars)

	async function refreshState() {
		if (!actorDid || !$session?.did) {
			followUri = null
			return
		}
		try {
			followUri = await findFollowUri(actorDid)
		} catch (e) {
			error = e?.message || String(e)
		}
	}

	$effect(() => {
		refreshState()
	})

	async function toggle() {
		if (!$session?.did) {
			error = t('follow.error', {message: 'Not authenticated'})
			return
		}
		error = ''
		pending = true
		try {
			if (followUri) {
				await unfollowActor(followUri)
				await deleteR4Favorite(actorDid)
				followUri = null
			} else {
				const res = await followActor(actorDid)
				followUri = res?.uri || null
				await createR4Favorite(actorDid)
			}
			await refreshState()
		} catch (e) {
			error = e?.message || String(e)
		} finally {
			pending = false
		}
	}
</script>

{#if $session?.did}
	<Button
		onclick={toggle}
		disabled={pending}
		variant={followUri ? 'default' : 'secondary'}
		size="sm"
	>
		{#if followUri}
			<Star class="h-4 w-4 mr-1 fill-current" />
			Unfavorite
		{:else}
			<Star class="h-4 w-4 mr-1" />
			Favorite
		{/if}
	</Button>
{:else}
	<Button variant="secondary" size="sm" disabled>
		<Star class="h-4 w-4 mr-1" />
		Favorite
	</Button>
{/if}
{#if error}<div class="mt-2 text-sm text-foreground/70">{error}</div>{/if}
