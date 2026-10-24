<script>
	import {formatDuration} from '#lib/dates.js'

	/** @type {{currentTime: number, mediaDuration: number, trackDuration?: number | null, onseek?: (time: number) => void, disabled?: boolean, isPlaying?: boolean}} */
	let {
		currentTime,
		mediaDuration,
		trackDuration,
		onseek,
		disabled = false,
		isPlaying = false
	} = $props()

	let duration = $derived(Number.isFinite(mediaDuration) ? mediaDuration : (trackDuration ?? NaN))
	let hasDuration = $derived(Number.isFinite(duration) && duration > 0)
	let fill = $derived(hasDuration ? ((currentTime / duration) * 100).toFixed(1) : '0')
	let remainingTime = $derived(hasDuration ? Math.max(0, duration - currentTime) : NaN)
</script>

<r4-player-progress playing={isPlaying}>
	<time>{formatDuration(currentTime, '-:--')}</time>
	<input
		type="range"
		min="0"
		max={hasDuration ? duration : 0}
		step="any"
		value={currentTime}
		oninput={(e) => onseek?.(Number(e.currentTarget.value))}
		disabled={disabled || !hasDuration}
		style="--range-fill: {fill}%"
	/>
	<time data-remaining>-{formatDuration(remainingTime, '-:--')}</time>
	<time>{formatDuration(duration, '-:--')}</time>
</r4-player-progress>

<style>
	r4-player-progress {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-2);
		line-height: 1;
	}

	time {
		position: relative;
		top: 0.1em;
		font-size: var(--font-1);
		color: var(--gray-9);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	time[data-remaining] {
		color: var(--accent-9);
	}

	input {
		flex: 1;
		z-index: 1;
	}

	r4-player-progress[playing='false'] input:enabled {
		--range-color: var(--gray-6);

		&::-webkit-slider-thumb {
			background: var(--accent-9);
		}

		&::-moz-range-thumb {
			background: var(--accent-9);
			border-color: var(--accent-9);
		}
	}
</style>
