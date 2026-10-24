<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
  import { Label } from '#lib/components/ui/label/index.js';
  import { Languages } from 'lucide-svelte';
  import { locale as localeStore, translate, availableLocales } from '#lib/i18n/index.js';

  const t = (key, vars = {}) => translate($localeStore, key, vars);
</script>

<div class="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Languages class="h-5 w-5" />
        {t('settings.languageTitle')}
      </CardTitle>
      <CardDescription>
        {t('settings.languageDescription')}
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-2">
      <Label for="language-select">{t('settings.languageLabel')}</Label>
      <select
        id="language-select"
        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        bind:value={$localeStore}
      >
        {#each availableLocales as option}
          <option value={option.code}>{option.label}</option>
        {/each}
      </select>
      <p class="text-xs text-muted-foreground mt-2">
        Language preference is stored locally in your browser.
      </p>
    </CardContent>
  </Card>
</div>
