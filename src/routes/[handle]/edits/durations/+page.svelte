<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getContext } from 'svelte';
  import { useLiveQuery } from '@tanstack/svelte-db';
  import { tracksCollection, loadTracksForDid, updateTrack } from '$lib/stores/tracks-db';
  import { parseTrackUrl } from '$lib/services/url-patterns';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import StateCard from '$lib/components/ui/state-card.svelte';
  import { session } from '$lib/state/session';
  import { Loader2, Clock3, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-svelte';

  const profileContext = getContext('profile');
  const did = $derived(profileContext?.did);
  const handle = $derived(profileContext?.handle);

  const tracksQuery = useLiveQuery(
    (q) => q.from({ tracks: tracksCollection }),
    []
  );

  const tracks = $derived.by(() => {
    const all = tracksQuery.data || [];
    if (!did) return [];
    return all.filter((t) => t.authorDid === did && !t.duration_seconds);
  });

  let loadingTracks = $state(false);
  let working = $state(false);
  let status = $state('');
  let processed = $state(0);
  let total = $state(0);
  let runState = $state<Record<string, { status: 'idle' | 'working' | 'success' | 'error'; duration?: number; message?: string }>>({});

  let sessionData = $state({ did: null as string | null, handle: null as string | null });
  const unsubscribeSession = session.subscribe((value) => {
    sessionData = value;
  });
  onDestroy(() => {
    unsubscribeSession?.();
  });

  const isOwner = $derived(sessionData?.did && did && sessionData.did === did);
  const missingDurations = $derived(tracks);

  function formatDuration(seconds?: number) {
    if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '';
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function updateRun(uri: string, next: Partial<{ status: 'idle' | 'working' | 'success' | 'error'; duration: number; message: string }>) {
    runState = {
      ...runState,
      [uri]: {
        status: runState[uri]?.status ?? 'idle',
        ...runState[uri],
        ...next,
      },
    };
  }

  function loadScriptOnce(src: string, check: () => boolean) {
    return new Promise<void>((resolve, reject) => {
      try {
        if (check()) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      } catch (e) {
        reject(e);
      }
    });
  }

  let ytReady: Promise<void> | null = null;
  function ensureYouTubeAPI() {
    if (!ytReady) {
      ytReady = new Promise<void>((resolve, reject) => {
        if (window.YT?.Player) {
          resolve();
          return;
        }
        window.onYouTubeIframeAPIReady = () => resolve();
        loadScriptOnce('https://www.youtube.com/iframe_api', () => !!window.YT?.Player).catch(reject);
      });
    }
    return ytReady;
  }

  async function getYouTubeDuration(videoId: string): Promise<number> {
    await ensureYouTubeAPI();
    return new Promise((resolve, reject) => {
      const holder = document.createElement('div');
      holder.style.display = 'none';
      document.body.appendChild(holder);

      const cleanup = (player?: any) => {
        try { player?.destroy?.(); } catch {}
        holder.remove();
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out fetching YouTube duration'));
      }, 12000);

      const player = new window.YT.Player(holder, {
        videoId,
        events: {
          onReady: (event) => {
            try {
              const seconds = event?.target?.getDuration?.() || 0;
              clearTimeout(timeout);
              cleanup(event?.target);
              resolve(seconds);
            } catch (e) {
              clearTimeout(timeout);
              cleanup(event?.target);
              reject(e);
            }
          },
          onError: (err) => {
            clearTimeout(timeout);
            cleanup();
            reject(new Error(`YouTube error ${err?.data ?? ''}`));
          },
        },
      });
    });
  }

  let vimeoReady: Promise<void> | null = null;
  function ensureVimeoAPI() {
    if (!vimeoReady) {
      vimeoReady = loadScriptOnce('https://player.vimeo.com/api/player.js', () => !!window.Vimeo?.Player);
    }
    return vimeoReady;
  }

  async function getVimeoDuration(id: string): Promise<number> {
    await ensureVimeoAPI();
    return new Promise((resolve, reject) => {
      const holder = document.createElement('div');
      holder.style.display = 'none';
      document.body.appendChild(holder);

      const player = new window.Vimeo.Player(holder, { id });
      const cleanup = () => {
        player.unload().catch(() => {});
        holder.remove();
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out fetching Vimeo duration'));
      }, 12000);

      player.on('loaded', async () => {
        try {
          const seconds = await player.getDuration();
          clearTimeout(timeout);
          cleanup();
          resolve(seconds);
        } catch (e) {
          clearTimeout(timeout);
          cleanup();
          reject(e);
        }
      });
      player.on('error', (e: any) => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error(e?.message || 'Vimeo error'));
      });
    });
  }

  async function getFileDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = url;
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out reading file metadata'));
      }, 8000);
      const cleanup = () => {
        clearTimeout(timeout);
        audio.src = '';
      };
      audio.onloadedmetadata = () => {
        cleanup();
        resolve(audio.duration || 0);
      };
      audio.onerror = () => {
        cleanup();
        reject(new Error('Could not load media file'));
      };
    });
  }

  async function fetchDurationForTrack(track: any): Promise<number> {
    const meta = parseTrackUrl(track?.url || '');
    if (!meta) throw new Error('Unsupported media URL');

    if (meta.provider === 'youtube') {
      if (!meta.id) throw new Error('Missing video ID');
      return getYouTubeDuration(meta.id);
    }
    if (meta.provider === 'vimeo') {
      if (!meta.id) throw new Error('Missing video ID');
      return getVimeoDuration(meta.id);
    }
    if (meta.provider === 'file') {
      return getFileDuration(meta.url);
    }

    throw new Error(`Duration capture not supported for ${meta.provider}`);
  }

  async function loadAllTracks() {
    if (!did) return;
    loadingTracks = true;
    status = '';
    try {
      const first = await loadTracksForDid(did, { reset: false });
      let cursor = first?.cursor;
      while (cursor) {
        const more = await loadTracksForDid(did, { cursor });
        cursor = more?.cursor;
      }
    } catch (e) {
      status = (e as Error)?.message || String(e);
    } finally {
      loadingTracks = false;
    }
  }

  async function fetchAllDurations() {
    if (!did) {
      status = 'Handle not resolved yet.';
      return;
    }
    if (!isOwner) {
      status = 'You need to be signed in as this profile to save durations.';
      return;
    }
    if (working) return;

    await loadAllTracks();
    const targets = tracks.filter((t) => !t.duration_seconds);
    total = targets.length;
    processed = 0;
    runState = {};
    working = true;
    status = targets.length === 0 ? 'All tracks already have durations.' : '';

    for (const track of targets) {
      updateRun(track.uri, { status: 'working', message: 'Fetching…' });
      try {
        const seconds = await fetchDurationForTrack(track);
        const rounded = Math.max(1, Math.round(seconds));
        await updateTrack(track.uri, { duration_seconds: rounded });
        updateRun(track.uri, { status: 'success', duration: rounded, message: 'Saved' });
      } catch (e) {
        const message = (e as Error)?.message || String(e);
        updateRun(track.uri, { status: 'error', message });
      } finally {
        processed += 1;
      }
    }

    working = false;
  }

  onMount(() => {
    if (did) {
      loadAllTracks().catch((e) => { status = (e as Error)?.message || String(e); });
    }
  });
</script>

<div class="max-w-5xl mx-auto space-y-4">
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Clock3 class="h-5 w-5" />
        Durations for @{handle}
      </CardTitle>
      <CardDescription>
        Fetch and save durations for tracks in this profile’s edits playlist (YouTube, Vimeo, and direct files).
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="flex flex-wrap gap-3">
        <Button onclick={loadAllTracks} disabled={loadingTracks || working} variant="outline">
          {#if loadingTracks}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            Loading tracks…
          {:else}
            <RefreshCw class="mr-2 h-4 w-4" />
            Refresh tracks
          {/if}
        </Button>
        <Button onclick={fetchAllDurations} disabled={working || loadingTracks || tracks.length === 0} variant="default">
          {#if working}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            Fetching ({processed}/{total || missingDurations.length})
          {:else}
            Get durations
          {/if}
        </Button>
        {#if !isOwner}
          <span class="text-xs text-muted-foreground">Sign in as this profile to save durations.</span>
        {/if}
      </div>

      {#if status}
        <div class="text-sm text-muted-foreground">{status}</div>
      {/if}

      <div class="text-sm text-muted-foreground">
        Tracks: {tracks.length} • Missing durations: {missingDurations.length}
      </div>
    </CardContent>
  </Card>

  {#if tracks.length === 0}
    <StateCard
      icon={Loader2}
      loading={loadingTracks}
      title={loadingTracks ? 'Loading tracks' : 'No tracks yet'}
      description={loadingTracks ? 'Fetching tracks from your profile…' : 'Add tracks to this profile to fetch durations.'}
    />
  {:else}
    <Card>
      <CardHeader>
        <CardTitle>Tracks</CardTitle>
        <CardDescription>Progress updates appear as each duration is captured.</CardDescription>
      </CardHeader>
      <CardContent class="divide-y divide-border">
        {#each tracks as track (track.uri)}
          {@const run = runState[track.uri]}
          <div class="py-3 flex items-start gap-3 justify-between">
            <div class="min-w-0">
              <p class="font-medium truncate">{track.title || 'Untitled track'}</p>
              <p class="text-xs text-muted-foreground truncate">{track.url}</p>
            </div>
            <div class="flex items-center gap-2 text-sm shrink-0">
              {#if run?.status === 'working'}
                <Loader2 class="h-4 w-4 animate-spin" />
                <span>Fetching…</span>
              {:else if run?.status === 'success'}
                <CheckCircle2 class="h-4 w-4 text-foreground" />
                <span class="font-mono">{formatDuration(run.duration) || `${run.duration ?? ''}s`}</span>
              {:else if run?.status === 'error'}
                <AlertCircle class="h-4 w-4 text-amber-500" />
                <span class="max-w-[12rem] truncate text-amber-500" title={run.message}>{run.message || 'Error'}</span>
              {:else if track.duration_seconds}
                <span class="font-mono">{formatDuration(track.duration_seconds)}</span>
              {:else}
                <span class="text-muted-foreground text-xs">Pending</span>
              {/if}
            </div>
          </div>
        {/each}
      </CardContent>
    </Card>
  {/if}
</div>
