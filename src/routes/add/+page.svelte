<script lang="ts">
	import {createTrack} from '#lib/services/r4-service.js'
	import TrackForm from '#lib/components/TrackForm.svelte'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js'
	import {parseAtUri} from '#lib/services/track-uri.js'
	import {CheckCircle2} from 'lucide-svelte'
	import StateCard from '#lib/components/ui/state-card.svelte'
	import {Button} from '#lib/components/ui/button/index.js'
	import {locale, translate} from '#lib/i18n/index.js'
	import {session} from '#lib/state/session.js'
	import {goto} from '$app/navigation'

	let savedUri = $state('')
	const savedAt = $derived(savedUri ? parseAtUri(savedUri) : null)
	const t = (key, vars = {}) => translate($locale, key, vars)
	const userHandle = $derived($session?.handle || '')

	function viewTrack() {
		if (!savedAt || !userHandle) return
		goto(`/@${encodeURIComponent(userHandle)}/${encodeURIComponent(savedAt.rkey)}`)
	}

	async function onCreate({url, title, description, discogs_url}) {
		const res = await createTrack({url, title, description, discogs_url})
		savedUri = res?.data?.uri || res?.uri || ''
		return res
	}
</script>

<div class="container max-w-2xl py-8">
	<Card>
		<CardHeader>
			<CardTitle>{t('add.title')}</CardTitle>
		</CardHeader>
		<CardContent>
			<TrackForm submitLabel={t('forms.publish')} onSubmit={onCreate} />

			{#if savedAt}
				<div class="mt-6">
					<StateCard
						icon={CheckCircle2}
						title={t('add.successTitle')}
						description={t('add.successDescription')}
					>
						{#snippet actions()}
							<Button variant="outline" onclick={viewTrack}>
								{t('add.viewTrack')}
							</Button>
						{/snippet}
					</StateCard>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
