<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import { cn } from "#lib/utils/index.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DropdownMenuPrimitive.SubContentProps = $props();
</script>

<DropdownMenuPrimitive.SubContent
	bind:ref
	class={cn(
		"bg-background text-foreground z-50 min-w-[8rem] rounded-md border border-border p-1 shadow-lg focus:outline-none",
		className
	)}
	{...restProps}
/>
