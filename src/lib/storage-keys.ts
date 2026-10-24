/** All localStorage keys used by the app. Add new keys here so a reset clears them. */
export const LOCAL_STORAGE_KEYS = {
	appState: 'r4-app-state',
	appStateQueue: 'r4-app-state-queue',
	trackMeta: 'r4-track-meta',
	chatSeen: 'r4-chat-seen',
	chatMuted: 'r4-chat-muted'
} as const
