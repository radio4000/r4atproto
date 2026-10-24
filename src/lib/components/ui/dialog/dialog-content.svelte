<script lang="ts">
	import { Dialog as DialogPrimitive, type WithoutChildrenOrChild } from "bits-ui";
	import X from "@lucide/svelte/icons/x";
	import type { Snippet } from "svelte";
	import * as Dialog from "./index";
	import { cn } from "#lib/utils/index.js";
	import { locale, translate } from "#lib/i18n/index.js";

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		children,
		...restProps
	}: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
		portalProps?: DialogPrimitive.PortalProps;
		children: Snippet;
	} = $props();
	const t = (key: string) => translate($locale, key);
</script>

<Dialog.Portal {...portalProps}>
	<Dialog.Overlay />
	<DialogPrimitive.Content
		bind:ref
		class={cn(
			"bg-background fixed left-[50%] top-[50%] z-50 flex flex-col w-full max-w-lg max-h-[85dvh] translate-x-[-50%] translate-y-[-50%] border shadow-lg sm:rounded-lg transition-all duration-150 data-[state=open]:scale-100 data-[state=closed]:scale-95 data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
			className
		)}
		{...restProps}
	>
		<div class="overflow-y-auto flex-1 p-6">
			{@render children?.()}
		</div>
		<DialogPrimitive.Close
			class="ring-offset-background focus:ring-ring absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none z-10"
		>
			<X class="size-4" />
			<span class="sr-only">{t("dialog.close")}</span>
		</DialogPrimitive.Close>
	</DialogPrimitive.Content>
</Dialog.Portal>
