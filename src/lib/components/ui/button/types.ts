import { type VariantProps, tv } from "tailwind-variants";

export const buttonVariants = tv({
	base: "ring-offset-background focus-visible:ring-foreground inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:border-border disabled:text-foreground disabled:bg-background [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	variants: {
		variant: {
			default: "bg-background text-foreground border border-border hover:bg-foreground hover:text-background hover:border-foreground shadow-sm",
			primary: "bg-foreground text-background border border-foreground hover:bg-background hover:text-foreground shadow-sm",
			destructive: "bg-foreground text-background border border-foreground hover:bg-background hover:text-foreground shadow-sm",
			outline:
				"border border-border bg-background hover:bg-foreground hover:text-background hover:border-foreground",
			secondary: "bg-background text-foreground border border-border hover:bg-foreground hover:text-background hover:border-foreground",
			ghost: "hover:bg-foreground hover:text-background border border-transparent",
			link: "text-foreground underline-offset-4 hover:underline",
		},
		size: {
			default: "h-10 px-4 py-2",
			sm: "h-9 rounded-md px-3",
			lg: "h-11 rounded-md px-8",
			icon: "h-10 w-10",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});

export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
export type ButtonSize = VariantProps<typeof buttonVariants>["size"];