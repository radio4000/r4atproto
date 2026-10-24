# Global styles

Classless: style elements, custom elements (`r4-*`) and their state attributes (`aria-current`, `aria-pressed`, `expanded="true"`), never classes. Every value comes from a token in variables.css.

The `@import` order in style.css is the cascade order — later files win.

variables.css holds the base tokens. color-scales.css derives the 1..12 gray and accent scales from `--gray-light`/`--gray-dark` and `--accent-light`/`--accent-dark` (theme.css) — edit those base pairs, not the scales. Ported from r4-svelte; keep them in step.

Breakpoints are 520px, 768px and 1024px, as in r4-svelte. 768px switches between the desktop rail and the mobile tab bar.
