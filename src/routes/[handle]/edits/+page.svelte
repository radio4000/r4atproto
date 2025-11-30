<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';

  const { data } = $props();
  const handle = $derived(data?.handle ? data.handle.replace(/^@/, '') : '');
  const durationPath = $derived(handle ? `/@${encodeURIComponent(handle)}/edits/durations` : '/edits/durations');
</script>

<div class="max-w-4xl mx-auto space-y-4">
  <Card>
    <CardHeader>
      <CardTitle>Edits</CardTitle>
      <CardDescription>Tools for managing the edits playlist.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <p class="text-sm text-muted-foreground">
        Capture and review durations for tracks in your edits playlist.
      </p>
      <Button href={durationPath} variant="outline" class="w-full">
        Open duration fetcher
      </Button>
    </CardContent>
  </Card>
</div>
