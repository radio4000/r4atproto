<script lang="ts">
	import {bskyOAuth} from '#lib/services/bsky-oauth.js'
	import {session} from '#lib/state/session.js'
	import {Button} from '#lib/components/ui/button/index.js'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js'
	import {Input} from '#lib/components/ui/input/index.js'
	import {Label} from '#lib/components/ui/label/index.js'
	import {Loader2} from 'lucide-svelte'
	import {locale, translate} from '#lib/i18n/index.js'

	interface Props {
		variant?: 'default' | 'settings'
		showCard?: boolean
		title?: string
		description?: string
	}

	let {variant = 'default', showCard = true, title, description}: Props = $props()

	let handle = $state('')
	let error = $state('')
	let signingIn = $state(false)
	const t = (key, vars = {}) => translate($locale, key, vars)

	const displayTitle = $derived(title || t('settings.signInTitle'))
	const displayDescription = $derived(description || t('settings.signInDescription'))

	async function handleSignIn(e?: Event) {
		if (e) e.preventDefault()

		if (!handle.trim()) {
			error = t('home.errorRequired')
			return
		}

		error = ''
		signingIn = true

		try {
			await bskyOAuth.signIn(handle.trim())
			session.refresh()
		} catch (err) {
			error = t('home.errorMessage', {message: (err as Error)?.message || 'Unknown error'})
			signingIn = false
		}
	}
</script>

{#if showCard}
	{#if variant === 'default'}
		<Card class="border shadow-xl">
			<CardContent class="pt-6">
				<form onsubmit={handleSignIn} class="space-y-6">
					<div class="space-y-2">
						<Label for="signin-handle" class="text-base">
							{t('home.handleLabel')}
						</Label>
						<Input
							id="signin-handle"
							type="text"
							placeholder={t('home.handlePlaceholder')}
							bind:value={handle}
							disabled={signingIn}
							class="h-12 text-base"
						/>
					</div>

					{#if error}
						<div
							class="rounded-lg bg-destructive/15 border border-destructive/20 p-4 text-sm text-destructive"
						>
							{error}
						</div>
					{/if}

					<Button
						type="submit"
						class="w-full h-12 text-base"
						disabled={signingIn || !handle.trim()}
					>
						{#if signingIn}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{t('home.submitting')}
						{:else}
							{t('home.submit')}
						{/if}
					</Button>
				</form>
			</CardContent>
		</Card>
	{:else}
		<Card>
			<CardHeader>
				<CardTitle>{displayTitle}</CardTitle>
				<CardDescription>{displayDescription}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onsubmit={handleSignIn} class="space-y-4">
					<div class="space-y-2">
						<Label for="signin-handle">{t('home.handleLabel')}</Label>
						<Input
							id="signin-handle"
							type="text"
							placeholder={t('home.handlePlaceholder')}
							bind:value={handle}
							disabled={signingIn}
						/>
					</div>

					{#if error}
						<div
							class="rounded-lg bg-destructive/15 border border-destructive/20 p-4 text-sm text-destructive"
						>
							{error}
						</div>
					{/if}

					<Button type="submit" class="w-full" disabled={signingIn || !handle.trim()}>
						{#if signingIn}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{t('settings.signInWorking')}
						{:else}
							{t('settings.signInButton')}
						{/if}
					</Button>
				</form>
			</CardContent>
		</Card>
	{/if}
{:else}
	<form onsubmit={handleSignIn} class="space-y-4">
		<div class="space-y-2">
			<Label for="signin-handle">{t('home.handleLabel')}</Label>
			<Input
				id="signin-handle"
				type="text"
				placeholder={t('home.handlePlaceholder')}
				bind:value={handle}
				disabled={signingIn}
			/>
		</div>

		{#if error}
			<div
				class="rounded-lg bg-destructive/15 border border-destructive/20 p-4 text-sm text-destructive"
			>
				{error}
			</div>
		{/if}

		<Button type="submit" class="w-full" disabled={signingIn || !handle.trim()}>
			{#if signingIn}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{t('settings.signInWorking')}
			{:else}
				{t('settings.signInButton')}
			{/if}
		</Button>
	</form>
{/if}
