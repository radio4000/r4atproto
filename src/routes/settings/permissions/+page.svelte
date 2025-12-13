<script lang="ts">
  import { bskyOAuth } from '$lib/services/bsky-oauth';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Loader2, Shield } from 'lucide-svelte';
  import { locale, translate } from '$lib/i18n';

  let working = $state(false);
  let permissionError = $state('');
  const t = (key, vars = {}) => translate($locale, key, vars);

  async function managePermissions() {
    try {
      working = true;
      permissionError = '';
      console.log('Requesting permissions...');
      await bskyOAuth.requestScopes();
      console.log('Permissions requested (should have redirected)');
      // If we reach here without redirect, something went wrong
      permissionError = 'Expected to redirect but did not. Check console for errors.';
    } catch (e) {
      console.error('Permission request error:', e);
      permissionError = String(e?.message || e || 'Failed to request permissions');
    } finally {
      working = false;
    }
  }
</script>

<div class="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Shield class="h-5 w-5" />
        {t('settings.permissionsTitle')}
      </CardTitle>
      <CardDescription>
        {t('settings.permissionsDescription')}
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="rounded-lg bg-muted/50 p-3 text-sm space-y-2">
        <p class="font-semibold mb-2">{t('settings.permissionsAtProtocolLabel')}</p>
        <div class="space-y-2 text-xs">
          <div class="border-l-2 border-border pl-2">
            <p class="font-mono text-foreground">com.radio4000.track</p>
            <p class="text-muted-foreground">{t('settings.permissionsActionsCreateUpdateDelete')}</p>
          </div>
          <div class="border-l-2 border-border pl-2">
            <p class="font-mono text-foreground">com.radio4000.favorite</p>
            <p class="text-muted-foreground">{t('settings.permissionsActionsCreateUpdateDeleteFavorites')}</p>
          </div>
          <div class="border-l-2 border-border pl-2">
            <p class="font-mono text-foreground">com.radio4000.profile</p>
            <p class="text-muted-foreground">{t('settings.permissionsActionsCreateUpdate')}</p>
          </div>
          <div class="border-l-2 border-border pl-2">
            <p class="font-mono text-foreground">com.radio4000.sync</p>
            <p class="text-muted-foreground">{t('settings.permissionsActionsCreateUpdate')}</p>
          </div>
        </div>
      </div>
      <Button onclick={managePermissions} disabled={working} variant="outline" class="w-full">
        {#if working}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          {t('settings.permissionsWorking')}
        {:else}
          <Shield class="mr-2 h-4 w-4" />
          {t('settings.permissionsButton')}
        {/if}
      </Button>
      <p class="text-xs text-muted-foreground">
        {t('settings.permissionsFootnote')}
      </p>
      {#if permissionError}
        <div class="rounded-md bg-destructive/15 p-3 text-sm text-foreground/70">
          {permissionError}
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
