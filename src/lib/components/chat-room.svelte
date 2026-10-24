<script>
	import {page} from '$app/state'
	import {appState} from '#lib/app-state.svelte.js'
	import {deleteChatMessage, fetchChatHistory, sendChatMessage, watchChat} from '#lib/chat.js'
	import {authHref, channelHref} from '#lib/links.js'
	import {relativeDateDetailed} from '#lib/dates.js'
	import ChannelAvatar from '#lib/components/channel-avatar.svelte'
	import LinkEntities from '#lib/components/link-entities.svelte'
	import Icon from '#lib/components/icon.svelte'
	import * as m from '#lib/paraglide/messages.js'

	/** @type {{radioDid: string}} */
	let {radioDid} = $props()
	const uid = $props.id()

	/** @type {import('#lib/chat.js').ChatMessage[]} */
	let messages = $state([])
	let loading = $state(true)
	let text = $state('')
	let sending = $state(false)
	let error = $state('')
	/** @type {HTMLElement | undefined} */
	let list = $state()

	function add(message) {
		if (messages.some((m) => m.id === message.id)) return
		messages = [...messages, message].toSorted((a, b) => a.created_at.localeCompare(b.created_at))
	}

	$effect(() => {
		const did = radioDid
		loading = true
		messages = []
		fetchChatHistory(did)
			.then((history) => {
				for (const message of history) add(message)
			})
			.catch((err) => console.warn('chat history failed', err))
			.finally(() => (loading = false))
		return watchChat(did, {
			added: add,
			removed: (id) => (messages = messages.filter((m) => m.id !== id))
		})
	})

	// Keep the newest message in view
	$effect(() => {
		void messages.length
		list?.scrollTo({top: list.scrollHeight})
	})

	async function send(event) {
		event.preventDefault()
		if (!text.trim() || sending) return
		sending = true
		error = ''
		try {
			add(await sendChatMessage(radioDid, text))
			text = ''
		} catch (err) {
			error = m.chat_send_failed({message: err instanceof Error ? err.message : String(err)})
		} finally {
			sending = false
		}
	}

	async function remove(id) {
		messages = messages.filter((m) => m.id !== id)
		await deleteChatMessage(id).catch((err) => console.warn('delete failed', err))
	}
</script>

<r4-chat-room>
	<ol bind:this={list} aria-live="polite">
		{#each messages as message (message.id)}
			<li>
				<a href={channelHref(message.handle)} title="@{message.handle}">
					<ChannelAvatar src={message.avatar} alt={message.handle} />
				</a>
				<article>
					<header>
						<a href={channelHref(message.handle)}>@{message.handle}</a>
						<time datetime={message.created_at}>{relativeDateDetailed(message.created_at)}</time>
						{#if message.did === appState.session?.did}
							<button
								type="button"
								onclick={() => remove(message.id)}
								title={m.chat_delete()}
								aria-label={m.chat_delete()}
							>
								<Icon icon="delete" size={14} />
							</button>
						{/if}
					</header>
					<p><LinkEntities text={message.text} /></p>
				</article>
			</li>
		{:else}
			<li>
				<r4-empty
					><p role="status">{loading ? m.common_loading() : m.chat_room_empty()}</p></r4-empty
				>
			</li>
		{/each}
	</ol>

	{#if appState.session}
		<form onsubmit={send}>
			<label for="{uid}-text">{m.chat_input_placeholder()}</label>
			<r4-chat-input>
				<input
					id="{uid}-text"
					type="text"
					maxlength="300"
					autocomplete="off"
					bind:value={text}
					placeholder={m.chat_input_placeholder()}
				/>
				<button type="submit" disabled={!text.trim() || sending} aria-busy={sending}
					>{m.chat_send_button()}</button
				>
			</r4-chat-input>
			<small>{m.chat_public_note()}</small>
			{#if error}<p role="alert">{error}</p>{/if}
		</form>
	{:else}
		<p><a href={authHref(page.url.pathname)}>{m.chat_sign_in()}</a></p>
	{/if}
</r4-chat-room>

<style>
	r4-chat-room {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		height: var(--chat-height);
		padding: var(--space-2);
		background: var(--color-interface-elevated);
		border: 1px solid var(--color-interface-border);
		border-radius: var(--border-radius);
	}

	ol {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-y: auto;
	}

	li {
		display: grid;
		grid-template-columns: var(--chat-avatar-size) 1fr;
		gap: var(--space-2);
		align-items: start;

		&:has(r4-empty) {
			display: block;
			margin: auto;
		}
	}

	header {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		font-size: var(--font-3);

		a {
			font-weight: 600;
			text-decoration: none;
		}

		time {
			color: var(--gray-9);
			font-size: var(--font-2);
		}

		button {
			margin-inline-start: auto;
			min-width: 0;
			min-height: 0;
			padding: var(--space-1);
			background: none;
			border: none;
			color: var(--gray-9);
		}
	}

	p {
		overflow-wrap: anywhere;
	}

	label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	r4-chat-input {
		display: flex;
		gap: var(--space-1);

		input {
			flex: 1;
			min-width: 0;
		}
	}

	form {
		gap: var(--space-1);
	}
</style>
