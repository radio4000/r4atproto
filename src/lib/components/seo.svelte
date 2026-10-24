<script>
	import app from '#lib/config/app.json' with {type: 'json'}

	let {
		title,
		description = undefined,
		image = undefined,
		type = 'website',
		plain = false
	} = $props()
</script>

<svelte:head>
	<title>{plain ? title : `${title} · ${app.name}`}</title>
	<meta property="og:site_name" content={app.name} />
	<meta property="og:title" content={title} />
	<meta property="og:type" content={type} />
	{#if description}
		<meta name="description" content={description} />
		<meta property="og:description" content={description} />
	{/if}
	{#if image}<meta property="og:image" content={image} />{/if}
</svelte:head>
