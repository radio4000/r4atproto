<script lang="ts">
  import { session } from '#lib/state/session.js';
  import { theme, DEFAULT_LIGHT_COLORS, DEFAULT_DARK_COLORS } from '#lib/state/theme.js';
  import { setR4Profile } from '#lib/services/r4-service.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Label } from '#lib/components/ui/label/index.js';
  import { Loader2, Palette, Sun, Moon, MonitorSmartphone, RotateCcw } from 'lucide-svelte';
  import { locale, translate } from '#lib/i18n/index.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let themeSaving = $state(false);
  let themeSaved = $state(false);
  let themeError = $state('');
  const t = (key, vars = {}) => translate($locale, key, vars);

  // Redirect to account page if not authenticated
  onMount(() => {
    if (!$session?.did) {
      goto('/settings/account');
    }
  });

  // Helper function to convert HSL string to hex color
  function hslToHex(hsl: string): string {
    const [h, s, l] = hsl.split(' ').map((v) => parseFloat(v.replace('%', '')));
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = (l / 100) - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  // Helper function to convert hex color to HSL string
  function hexToHsl(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }

  // Get current effective theme mode
  let effectiveMode = $derived.by(() => {
    if ($theme.mode === 'auto') {
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return $theme.mode;
  });

  // Local color values
  let currentBg = $state('');
  let currentFg = $state('');
  let currentAccent = $state('');

  // Update color values when mode changes
  $effect(() => {
    currentBg = hslToHex(effectiveMode === 'dark' ? $theme.darkColors.background : $theme.lightColors.background);
    currentFg = hslToHex(effectiveMode === 'dark' ? $theme.darkColors.foreground : $theme.lightColors.foreground);
    currentAccent = hslToHex(effectiveMode === 'dark' ? $theme.darkColors.accent : $theme.lightColors.accent);
  });

  // Simple save function - call it manually
  async function saveTheme() {
    if (!$session?.did) return;

    themeSaving = true;
    themeError = '';
    themeSaved = false;

    try {
      // Update theme store
      if (effectiveMode === 'dark') {
        theme.setDarkColors({
          background: hexToHsl(currentBg),
          foreground: hexToHsl(currentFg),
          accent: hexToHsl(currentAccent),
        });
      } else {
        theme.setLightColors({
          background: hexToHsl(currentBg),
          foreground: hexToHsl(currentFg),
          accent: hexToHsl(currentAccent),
        });
      }

      // Save to AT Protocol
      await setR4Profile({
        mode: $theme.mode,
        lightBackground: effectiveMode === 'light' ? hexToHsl(currentBg) : $theme.lightColors.background,
        lightForeground: effectiveMode === 'light' ? hexToHsl(currentFg) : $theme.lightColors.foreground,
        lightAccent: effectiveMode === 'light' ? hexToHsl(currentAccent) : $theme.lightColors.accent,
        darkBackground: effectiveMode === 'dark' ? hexToHsl(currentBg) : $theme.darkColors.background,
        darkForeground: effectiveMode === 'dark' ? hexToHsl(currentFg) : $theme.darkColors.foreground,
        darkAccent: effectiveMode === 'dark' ? hexToHsl(currentAccent) : $theme.darkColors.accent,
      });

      themeSaved = true;
    } catch (error) {
      themeError = String(error?.message || error);
    } finally {
      themeSaving = false;
    }
  }

  // Reset to defaults
  function resetColors() {
    const defaultColors = effectiveMode === 'dark' ? DEFAULT_DARK_COLORS : DEFAULT_LIGHT_COLORS;
    currentBg = hslToHex(defaultColors.background);
    currentFg = hslToHex(defaultColors.foreground);
    currentAccent = hslToHex(defaultColors.accent);
    saveTheme();
  }
</script>

<div class="space-y-6">
  <!-- Theme Mode -->
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <MonitorSmartphone class="h-5 w-5" />
        {t('settings.appearanceThemeModeTitle')}
      </CardTitle>
      <CardDescription>
        {t('settings.appearanceThemeModeDescription')}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div class="space-y-2">
        <Label>{t('settings.appearanceSelectMode')}</Label>
        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            onclick={() => theme.setMode('auto')}
            disabled={$theme.mode === 'auto'}
            class="flex flex-col items-center gap-2 p-3 rounded-md border transition-all disabled:cursor-not-allowed {$theme.mode === 'auto' ? 'border-foreground text-background bg-foreground' : 'border-border hover:text-background hover:bg-foreground hover:border-transparent'}"
          >
            <MonitorSmartphone class="h-5 w-5" />
            <span class="text-xs font-medium">{t('settings.appearanceModeAuto')}</span>
          </button>
          <button
            type="button"
            onclick={() => theme.setMode('light')}
            disabled={$theme.mode === 'light'}
            class="flex flex-col items-center gap-2 p-3 rounded-md border transition-all disabled:cursor-not-allowed {$theme.mode === 'light' ? 'border-foreground text-background bg-foreground' : 'border-border hover:text-background hover:bg-foreground hover:border-transparent'}"
          >
            <Sun class="h-5 w-5" />
            <span class="text-xs font-medium">{t('settings.appearanceModeLight')}</span>
          </button>
          <button
            type="button"
            onclick={() => theme.setMode('dark')}
            disabled={$theme.mode === 'dark'}
            class="flex flex-col items-center gap-2 p-3 rounded-md border transition-all disabled:cursor-not-allowed {$theme.mode === 'dark' ? 'border-foreground text-background bg-foreground' : 'border-border hover:text-background hover:bg-foreground hover:border-transparent'}"
          >
            <Moon class="h-5 w-5" />
            <span class="text-xs font-medium">{t('settings.appearanceModeDark')}</span>
          </button>
        </div>
      </div>
    </CardContent>
  </Card>

  <!-- Theme Colors -->
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Palette class="h-5 w-5" />
        {t('settings.appearanceThemeColorsTitle')}
      </CardTitle>
      <CardDescription>
        {t('settings.appearanceThemeColorsDescription')}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div class="space-y-3 p-3 rounded-lg bg-muted/30">
        <div class="flex items-center justify-between">
          <h3 class="font-medium flex items-center gap-2">
            {#if effectiveMode === 'dark'}
              <Moon class="h-4 w-4" />
              {t('settings.appearanceDarkModeColors')}
            {:else}
              <Sun class="h-4 w-4" />
              {t('settings.appearanceLightModeColors')}
            {/if}
          </h3>
          {#if themeSaving}
            <span class="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 class="h-3 w-3 animate-spin" />
              {t('settings.appearanceSaving')}
            </span>
          {:else if themeSaved}
            <span class="text-xs text-primary">
              {t('settings.appearanceSaved')}
            </span>
          {/if}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="current-bg">{t('settings.appearanceBackground')}</Label>
            <div class="flex gap-2">
              <input
                id="current-bg"
                type="color"
                bind:value={currentBg}
                onchange={saveTheme}
                class="h-10 w-16 rounded border border-border cursor-pointer"
              />
              <Input
                type="text"
                bind:value={currentBg}
                onchange={saveTheme}
                placeholder={effectiveMode === 'dark' ? '#000000' : '#ffffff'}
                class="flex-1 font-mono text-xs"
              />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="current-fg">{t('settings.appearanceForeground')}</Label>
            <div class="flex gap-2">
              <input
                id="current-fg"
                type="color"
                bind:value={currentFg}
                onchange={saveTheme}
                class="h-10 w-16 rounded border border-border cursor-pointer"
              />
              <Input
                type="text"
                bind:value={currentFg}
                onchange={saveTheme}
                placeholder={effectiveMode === 'dark' ? '#ffffff' : '#000000'}
                class="flex-1 font-mono text-xs"
              />
            </div>
          </div>
          <div class="space-y-2 md:col-span-2">
            <Label for="current-accent">{t('settings.appearanceAccentColor')}</Label>
            <div class="flex gap-2">
              <input
                id="current-accent"
                type="color"
                bind:value={currentAccent}
                onchange={saveTheme}
                class="h-10 w-16 rounded border border-border cursor-pointer"
              />
              <Input
                type="text"
                bind:value={currentAccent}
                onchange={saveTheme}
                placeholder="#8b5cf6"
                class="flex-1 font-mono text-xs"
              />
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <Button
            onclick={resetColors}
            variant="secondary"
            size="sm"
            class="flex-1"
          >
            <RotateCcw class="mr-2 h-4 w-4" />
            {t('settings.appearanceResetToDefaults')}
          </Button>
          <Button
            onclick={saveTheme}
            variant="default"
            size="sm"
            class="flex-1"
            disabled={themeSaving}
          >
            {#if themeSaving}
              <Loader2 class="mr-2 h-4 w-4 animate-spin" />
              {t('settings.appearanceSaving')}
            {:else}
              <Palette class="mr-2 h-4 w-4" />
              {t('settings.appearanceSaveNow')}
            {/if}
          </Button>
        </div>
      </div>

      {#if themeError}
        <div class="rounded-md bg-destructive/15 p-3 text-sm text-foreground/70">
          {themeError}
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
