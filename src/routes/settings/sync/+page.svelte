<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';
  import { Label } from '#lib/components/ui/label/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { RefreshCw, Database, CheckCircle2, AlertCircle } from 'lucide-svelte';
  import { locale as localeStore, translate } from '#lib/i18n/index.js';
  import { session } from '#lib/state/session.js';
  import { goto } from '$app/navigation';
  import {
    getR4SyncConfig,
    setR4SyncConfig,
    fetchRadio4000Channel,
    fetchRadio4000Tracks,
    importRadio4000Tracks,
    listTracksByDid,
    getMyDid,
  } from '#lib/services/r4-service.js';
  import { loadTracksForDid } from '#lib/stores/tracks-db.js';
  import { onMount } from 'svelte';

  const t = (key: string, vars = {}) => translate($localeStore, key, vars);

  // Config
  let apiEndpoint = $state('https://oupgudlkspsmzkmeovlh.supabase.co');
  let apiKey = $state('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91cGd1ZGxrc3BzbXprbWVvdmxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTM0NTIwNzQsImV4cCI6MjAyOTAyODA3NH0.KAbKFBChJHtxTmOZM2pdeppIyNbcnQkEgSi6RA7OQdo');
  let channelSlug = $state('');

  // State
  let isLoading = $state(false);
  let isImporting = $state(false);
  let error = $state<string | null>(null);
  let channelInfo = $state<any>(null);
  let comparison = $state<{ total: number; imported: number; missing: number } | null>(null);
  let importProgress = $state<{ current: number; total: number; skipped: number } | null>(null);
  let importResult = $state<{ imported: number; skipped: number } | null>(null);
  let importErrors = $state<string[]>([]);

  onMount(async () => {
    // Redirect to account page if not authenticated
    if (!$session?.did) {
      goto('/settings/account');
      return;
    }

    try {
      const config = await getR4SyncConfig();
      if (config) {
        apiEndpoint = config.apiEndpoint;
        apiKey = config.apiKey;
        channelSlug = config.channelSlug;
      }
    } catch (err) {
      // Ignore auth errors on mount
      console.error('Failed to load sync config:', err);
    }
  });

  async function handleLoad() {
    error = null;
    channelInfo = null;
    comparison = null;
    importResult = null;
    isLoading = true;

    try {
      // Save config
      await setR4SyncConfig({ apiEndpoint, apiKey, channelSlug });

      // Fetch channel info only - no need to fetch all tracks yet
      const channel = await fetchRadio4000Channel(apiEndpoint, apiKey, channelSlug);
      if (!channel) {
        error = 'Channel not found';
        return;
      }
      channelInfo = channel;

      // Show ready state - comparison will happen during import
      comparison = {
        total: 0, // Will be computed during import
        imported: 0,
        missing: 0,
      };
    } catch (err) {
      error = (err as Error).message;
    } finally {
      isLoading = false;
    }
  }

  async function handleImport() {
    error = null;
    importResult = null;
    isImporting = true;
    importProgress = null;
    importErrors = [];

    try {
      // Fetch radio4000 tracks to get total count
      const r4Tracks = await fetchRadio4000Tracks(apiEndpoint, apiKey, channelSlug);

      // Update comparison with total before starting import
      comparison = {
        total: r4Tracks.length,
        imported: 0,
        missing: r4Tracks.length,
      };

      const result = await importRadio4000Tracks(
        apiEndpoint,
        apiKey,
        channelSlug,
        (current, total, skipped) => {
          importProgress = { current, total, skipped };
          // Update comparison during import
          comparison = {
            total: r4Tracks.length,
            imported: skipped + current,
            missing: total - current,
          };
        },
        (errorMsg) => {
          importErrors = [...importErrors, errorMsg];
        }
      );

      importResult = result;

      // Final comparison
      comparison = {
        total: r4Tracks.length,
        imported: result.imported + result.skipped,
        missing: 0,
      };

      // Load imported tracks into the reactive collection
      const myDid = await getMyDid();
      await loadTracksForDid(myDid, { reset: true });
    } catch (err) {
      error = (err as Error).message;
    } finally {
      isImporting = false;
      importProgress = null;
    }
  }
</script>

<div class="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Database class="h-5 w-5" />
        {t('settings.syncTitle')}
      </CardTitle>
      <CardDescription>
        {t('settings.syncDescription')}
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Error Message -->
      {#if error}
        <div class="flex items-start gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          <AlertCircle class="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{t('settings.syncError', { message: error })}</span>
        </div>
      {/if}

      <!-- Import Success Message -->
      {#if importResult}
        <div class="flex items-start gap-2 rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 class="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{t('settings.syncImportComplete', importResult)}</span>
        </div>
      {/if}

      <!-- Import Errors -->
      {#if importErrors.length > 0}
        <div class="space-y-2">
          <h4 class="text-sm font-medium text-destructive">Import Errors ({importErrors.length}):</h4>
          <div class="max-h-40 overflow-y-auto border rounded-md p-3 bg-destructive/5">
            {#each importErrors as errorMsg}
              <div class="text-xs text-destructive mb-1">{errorMsg}</div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Channel Slug Input -->
      <div class="space-y-2">
        <Label for="channel-slug">{t('settings.syncChannelSlugLabel')}</Label>
        <div class="flex gap-2">
          <Input
            id="channel-slug"
            type="text"
            placeholder={t('settings.syncChannelSlugPlaceholder')}
            bind:value={channelSlug}
            class="flex-1"
          />
          <Button onclick={handleLoad} disabled={isLoading || !channelSlug}>
            {#if isLoading}
              <RefreshCw class="h-4 w-4 mr-2 animate-spin" />
              {t('settings.syncLoading')}
            {:else}
              {t('settings.syncLoadButton')}
            {/if}
          </Button>
        </div>
      </div>

      <!-- Channel Info & Import -->
      {#if channelInfo}
        <div class="border-t pt-4 space-y-4">
          <!-- Channel Name -->
          <div class="text-sm">
            <span class="font-medium text-foreground">
              {channelInfo.name}
            </span>
            {#if channelInfo.description}
              <p class="text-muted-foreground mt-1">{channelInfo.description}</p>
            {/if}
          </div>

          <!-- Comparison Stats (only show if we have data) -->
          {#if comparison && comparison.total > 0}
            <div class="flex gap-4 text-sm text-muted-foreground">
              <span>{comparison.total} tracks total</span>
              <span>{comparison.imported} imported</span>
              {#if comparison.missing > 0}
                <span>{comparison.missing} remaining</span>
              {/if}
            </div>
          {/if}

          <!-- Import Button -->
          <div>
            <Button onclick={handleImport} disabled={isImporting}>
              {#if isImporting}
                <RefreshCw class="h-4 w-4 mr-2 animate-spin" />
                {#if importProgress}
                  {importProgress.current}/{importProgress.total}
                  {#if importProgress.skipped > 0}
                    ({importProgress.skipped} skipped)
                  {/if}
                {:else}
                  {t('settings.syncImporting')}
                {/if}
              {:else}
                Sync from Radio4000
              {/if}
            </Button>
          </div>
        </div>
      {/if}

      <!-- Config Details (Collapsed) -->
      <details class="border-t pt-4">
        <summary class="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          Configuration
        </summary>
        <div class="mt-4 space-y-3">
          <div class="space-y-2">
            <Label for="api-endpoint" class="text-xs">{t('settings.syncApiEndpoint')}</Label>
            <Input
              id="api-endpoint"
              type="text"
              bind:value={apiEndpoint}
              readonly
              class="text-xs"
            />
          </div>
          <div class="space-y-2">
            <Label for="api-key" class="text-xs">{t('settings.syncApiKey')}</Label>
            <Input
              id="api-key"
              type="text"
              bind:value={apiKey}
              readonly
              class="text-xs font-mono"
            />
          </div>
          <p class="text-xs text-muted-foreground">
            {t('settings.syncConfigNote')}
          </p>
        </div>
      </details>
    </CardContent>
  </Card>
</div>
