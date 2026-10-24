<script lang="ts">
	import {Button} from '#lib/components/ui/button/index.js'
	import Link from '#lib/components/legacy/Link.svelte'
	import {Menu} from 'lucide-svelte'
	import {locale, translate} from '#lib/i18n/index.js'

	const props = $props()
	const linksVal = $derived(props.links || [])
	const currentVal = $derived(props.current ?? '/')
	let open = $state(false)

	function toggle() {
		open = !open
	}
	function close() {
		open = false
	}

	const t = (key, vars = {}) => translate($locale, key, vars)
</script>

<header
	class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
>
	<div class="container flex h-14 items-center justify-between">
		<div class="flex items-center gap-6">
			<Link href="/" class="flex items-center space-x-2">
				<span class="font-bold text-xl">{t('nav.brand')}</span>
			</Link>

			<!-- Desktop Navigation -->
			<nav class="hidden md:flex items-center gap-6">
				{#each linksVal as [href, title]}
					<Link
						{href}
						class="text-sm font-medium transition-colors hover:text-primary"
						class:text-primary={currentVal === href}
						class:text-muted-foreground={currentVal !== href}
					>
						{title}
					</Link>
				{/each}
			</nav>
		</div>

		<!-- Mobile Menu Button -->
		<Button variant="ghost" size="sm" class="md:hidden" onclick={toggle}>
			<Menu class="h-5 w-5" />
			<span class="sr-only">{t('nav.toggle')}</span>
		</Button>
	</div>

	<!-- Mobile Navigation -->
	{#if open}
		<div class="md:hidden border-t border-border">
			<nav class="container grid gap-2 py-4">
				{#each linksVal as [href, title]}
					<Link
						{href}
						onclick={close}
						class="flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
						class:bg-accent={currentVal === href}
						class:text-accent-foreground={currentVal === href}
					>
						{title}
					</Link>
				{/each}
			</nav>
		</div>
	{/if}
</header>
