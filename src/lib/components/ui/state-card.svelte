<script lang="ts">
	import type { ComponentType, Snippet } from "svelte";
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle,
	} from "./card";
	import { cn } from "#lib/utils/index.js";

	type IconComponent = ComponentType<{ class?: string }>;

	let {
		title = "",
		description = "",
		icon: Icon = null,
		loading = false,
		children,
		actions,
		class: className,
	}: {
		title: string;
		description?: string;
		icon?: IconComponent | null;
		loading?: boolean;
		children?: Snippet;
		actions?: Snippet;
		class?: string;
	} = $props();
</script>

<Card class={cn(
	"text-center max-w-md mx-auto",
	loading && "border-none border-0 shadow-none bg-transparent",
	className
)}>
	<CardHeader class="items-center text-center space-y-4 pb-6">
		{#if Icon}
			<div class="rounded-full bg-muted p-4">
				<Icon class={cn("h-8 w-8 text-muted-foreground", loading && "animate-spin")} />
			</div>
		{/if}
		<div class="space-y-2">
			<CardTitle class="text-xl">{title}</CardTitle>
			{#if description}
				<CardDescription class="text-base">{description}</CardDescription>
			{/if}
		</div>
	</CardHeader>
	{#if children}
		<CardContent class="text-sm text-muted-foreground pb-6">
			{@render children?.()}
		</CardContent>
	{/if}
	{#if actions}
		<CardFooter class="flex justify-center gap-3 pt-0">
			{@render actions?.()}
		</CardFooter>
	{/if}
</Card>
