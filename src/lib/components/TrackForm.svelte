<script lang="ts">
  import { fetchOEmbed } from '#lib/services/oembed.js';
  import { parseDiscogsUrl, fetchDiscogs, extractSuggestions } from '#lib/services/discogs.service.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Label } from '#lib/components/ui/label/index.js';
  import { Textarea } from '#lib/components/ui/textarea/index.js';
  import { Loader2 } from 'lucide-svelte';
  import { locale, translate } from '#lib/i18n/index.js';

  const props = $props();
  const t = (key, vars = {}) => translate($locale, key, vars);
  const initialProp = $derived(props.initial || { url: '', title: '', description: '', discogs_url: '' });
  const submitText = $derived(props.submitLabel || t('forms.save'));
  const onSubmit = $derived(props.onSubmit || null);

  let url = $state('');
  let title = $state('');
  let description = $state('');
  let discogs_url = $state('');
  let status = $state('');
  let submitting = $state(false);
  let prefilled = $state(false);
  let discogsSuggestions = $state<string[]>([]);
  let discogsSuggestionsStatus = $state('');
  let discogsSuggestionsIsError = $state(false);
  let discogsLoading = $state(false);
  let discogsLookupId = 0;

  const discogsSearchUrl = $derived.by(() => {
    if (!url || !title) return '';
    const params = new URLSearchParams({ q: title, type: 'all' });
    return `https://www.discogs.com/search/?${params.toString()}`;
  });

  // Populate from initial when it arrives (edit case)
  $effect(() => {
    if (!prefilled && (initialProp.url || initialProp.title || initialProp.description || initialProp.discogs_url || initialProp.discogsUrl)) {
      url = initialProp.url || '';
      title = initialProp.title || '';
      description = initialProp.description || '';
      discogs_url = initialProp.discogs_url || initialProp.discogsUrl || '';
      prefilled = true;
    }
  });

  // Autofill title from oEmbed on create when URL present and title empty
  $effect(() => {
    if (url && !title) {
      (async () => {
        try {
          const data = await fetchOEmbed(url);
          if (data?.title && !title) title = data.title;
        } catch (_) {}
      })();
    }
  });

  function isDiscogsLink(link: string): boolean {
    try {
      const parsed = new URL(link);
      return parsed.hostname.includes('discogs.com');
    } catch (_) {
      return false;
    }
  }

  $effect(() => {
    const link = discogs_url?.trim();
    discogsSuggestions = [];
    discogsSuggestionsStatus = '';
    discogsSuggestionsIsError = false;
    discogsLoading = false;
    if (!link || !isDiscogsLink(link)) {
      return;
    }

    const info = (() => {
      try {
        return parseDiscogsUrl(link);
      } catch (_) {
        return undefined;
      }
    })();

    if (!info) {
      discogsSuggestionsStatus = t('forms.discogsInvalid');
      discogsSuggestionsIsError = true;
      return;
    }

    const requestId = ++discogsLookupId;
    discogsLoading = true;

    (async () => {
      try {
        const data = await fetchDiscogs(info);
        if (requestId !== discogsLookupId) return;
        const tags = extractSuggestions(data) || [];
        discogsSuggestions = tags;
        if (!tags.length) {
          discogsSuggestionsStatus = t('forms.discogsSuggestionsEmpty');
          discogsSuggestionsIsError = false;
        }
      } catch (err) {
        if (requestId !== discogsLookupId) return;
        discogsSuggestionsStatus = err?.message || t('forms.discogsGenericError');
        discogsSuggestionsIsError = true;
      } finally {
        if (requestId === discogsLookupId) discogsLoading = false;
      }
    })();
  });

  function hasDiscogsTag(tag: string): boolean {
    const slug = tag?.trim();
    if (!slug) return false;
    const hashtag = `#${slug}`.toLowerCase();
    const tokens = description?.split(/\s+/).filter(Boolean) ?? [];
    return tokens.some(token => token.toLowerCase() === hashtag);
  }

  function appendDiscogsTag(tag: string) {
    if (!tag || hasDiscogsTag(tag)) return;
    const slug = tag.trim();
    if (!slug) return;
    const hashtag = `#${slug}`;
    const base = description?.trim();
    description = base ? `${base} ${hashtag}`.trim() : hashtag;
  }

  function removeDiscogsTag(tag: string) {
    if (!hasDiscogsTag(tag)) return;
    const slug = tag.trim();
    if (!slug) return;
    const hashtag = `#${slug}`.toLowerCase();
    const tokens = description?.split(/\s+/).filter(Boolean) ?? [];
    description = tokens.filter((token) => token.toLowerCase() !== hashtag).join(' ');
  }

  function toggleDiscogsTag(tag: string) {
    if (!tag) return;
    if (hasDiscogsTag(tag)) {
      removeDiscogsTag(tag);
    } else {
      appendDiscogsTag(tag);
    }
  }

  async function submit(e) {
    e?.preventDefault?.();
    status = '';
    submitting = true;
    try {
      const res = await onSubmit?.({ url, title, description, discogs_url });
      return res;
    } catch (err) {
      status = t('forms.errorMessage', { message: err?.message || String(err) });
    } finally {
      submitting = false;
    }
  }
</script>

<form onsubmit={submit} class="space-y-6">
  <div class="space-y-2">
    <Label for="url">{t('forms.trackUrl')}</Label>
    <Input
      id="url"
      name="url"
      type="url"
      bind:value={url}
      placeholder={t('forms.trackUrlPlaceholder')}
      required
    />
  </div>

  <div class="space-y-2">
    <Label for="title">{t('forms.title')}</Label>
    <Input
      id="title"
      name="title"
      type="text"
      bind:value={title}
      placeholder={t('forms.titlePlaceholder')}
      required
    />
  </div>

  <div class="space-y-2">
    <Label for="description">{t('forms.description')}</Label>
    <Textarea
      id="description"
      name="description"
      bind:value={description}
      placeholder={t('forms.descriptionPlaceholder')}
      rows={3}
    />
  </div>

  <div class="space-y-2">
    <Label for="discogs_url">{t('forms.discogs')}</Label>
    <Input
      id="discogs_url"
      name="discogs_url"
      type="url"
      bind:value={discogs_url}
      placeholder={t('forms.discogsPlaceholder')}
    />
    {#if discogsSearchUrl}
      <p class="text-xs text-muted-foreground">
        {t('forms.discogsSearchHelp')}
        <a
          href={discogsSearchUrl}
          target="_blank"
          rel="noreferrer"
          class="underline-offset-2 hover:underline"
        >
          {t('forms.discogsSearchLink')}
        </a>
      </p>
    {/if}
    {#if discogsLoading}
      <p class="text-xs text-muted-foreground">{t('forms.discogsLoading')}</p>
    {:else if discogsSuggestions.length}
      <div class="space-y-2 rounded-md border border-border/60 p-3">
        <p class="text-xs font-medium text-foreground">
          {t('forms.discogsSuggestionsTitle')}
        </p>
        <p class="text-xs text-muted-foreground">{t('forms.discogsSuggestionsHint')}</p>
        <div class="flex flex-wrap gap-2">
          {#each discogsSuggestions as tag}
            {@const applied = hasDiscogsTag(tag)}
            <button
              type="button"
              class={`text-xs rounded-full border px-2 py-0.5 font-mono transition-colors ${applied ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border/70 bg-background hover:bg-muted'}`}
              onclick={() => toggleDiscogsTag(tag)}
            >#{tag}</button>
          {/each}
        </div>
      </div>
    {:else if discogsSuggestionsStatus}
      <p class={`text-xs ${discogsSuggestionsIsError ? 'text-destructive' : 'text-muted-foreground'}`}>
        {discogsSuggestionsStatus}
      </p>
    {/if}
  </div>

  {#if status}
    <div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
      {status}
    </div>
  {/if}

  <Button type="submit" class="w-full" disabled={submitting} variant="primary">
    {#if submitting}
      <Loader2 class="mr-2 h-4 w-4 animate-spin" />
      {t('settings.appearanceSaving')}
    {:else}
      {submitText}
    {/if}
  </Button>
</form>
