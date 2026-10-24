/**
 * Our lexicons, for checking records (as the app does) and query parameters.
 * Listed one by one: Workers have no import.meta.glob. A test checks the list
 * matches /lexicons.
 */
import {Lexicons, type LexiconDoc} from '@atproto/lexicon'
import {recordValidator} from '#lib/atproto/lexicon-validator.js'
import broadcast from '../../lexicons/radio/4000/broadcast.json' with {type: 'json'}
import channel from '../../lexicons/radio/4000/channel.json' with {type: 'json'}
import chatListMessages from '../../lexicons/radio/4000/chat/listMessages.json' with {type: 'json'}
import chatMessage from '../../lexicons/radio/4000/chat/message.json' with {type: 'json'}
import defs from '../../lexicons/radio/4000/defs.json' with {type: 'json'}
import follow from '../../lexicons/radio/4000/follow.json' with {type: 'json'}
import getRadios from '../../lexicons/radio/4000/getRadios.json' with {type: 'json'}
import listBroadcasts from '../../lexicons/radio/4000/listBroadcasts.json' with {type: 'json'}
import listRadios from '../../lexicons/radio/4000/listRadios.json' with {type: 'json'}
import listTracks from '../../lexicons/radio/4000/listTracks.json' with {type: 'json'}
import track from '../../lexicons/radio/4000/track.json' with {type: 'json'}

export const docs = [
	broadcast,
	channel,
	chatListMessages,
	chatMessage,
	defs,
	follow,
	getRadios,
	listBroadcasts,
	listRadios,
	listTracks,
	track
] as unknown as LexiconDoc[]

export const isValidRecord = recordValidator(docs)

export const lexicons = new Lexicons(docs)
