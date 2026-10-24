<script lang="ts">
	import {page} from '$app/state'

	const {
		title = 'Radio4000',
		description = 'Share and discover music tracks on the AT Protocol.',
		image = '',
		favicon = '/favicon.png',
		type = 'website',
		noIndex = false
	} = $props()

	const siteName = 'Radio4000'
	const resolvedTitle = $derived(title ? `${title} | ${siteName}` : siteName)
	const safeDescription = $derived(
		description || 'Share and discover music tracks on the AT Protocol.'
	)
	const canonical = $derived(() => {
		const url = page?.url
		if (!url) return ''
		const {origin, pathname, search} = url

		if (origin) return `${origin}${pathname}${search}`
		if (typeof window !== 'undefined' && window.location?.origin) {
			return `${window.location.origin}${pathname}${search}`
		}
		return `${pathname}${search}`
	})

	const ogImage = $derived(image || favicon)
	const twitterCard = $derived(image ? 'summary_large_image' : 'summary')
</script>

<svelte:head>
	<title>{resolvedTitle}</title>
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" href={favicon} />
	{#if canonical}
		<link rel="canonical" href={canonical} />
	{/if}
	<meta name="description" content={safeDescription} />
	{#if noIndex}
		<meta name="robots" content="noindex" />
	{/if}
	<meta property="og:site_name" content={siteName} />
	<meta property="og:title" content={resolvedTitle} />
	<meta property="og:description" content={safeDescription} />
	<meta property="og:type" content={type} />
	{#if canonical}
		<meta property="og:url" content={canonical} />
	{/if}
	{#if ogImage}
		<meta property="og:image" content={ogImage} />
	{/if}
	<meta name="twitter:card" content={twitterCard} />
	<meta name="twitter:title" content={resolvedTitle} />
	<meta name="twitter:description" content={safeDescription} />
	{#if ogImage}
		<meta name="twitter:image" content={ogImage} />
	{/if}
</svelte:head>
