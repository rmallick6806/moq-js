/// <reference types="vite/client" />

import * as Message from "./worker/message"
import { Root, isAudioTrack } from "../media/catalog"
import { RingShared } from "../common/ring"
import MediaWorker from "./worker/index?worker&inline"

export interface PlayerConfig {
	canvas: OffscreenCanvas
	catalog: Root
}

// Responsible for sending messages to the worker and worklet.
export default class Backend {
	// General worker
	#worker: Worker

	constructor(config: PlayerConfig) {
		// TODO does this block the main thread? If so, make this async
		// @ts-expect-error: The Vite typing is wrong https://github.com/vitejs/vite/blob/22bd67d70a1390daae19ca33d7de162140d533d6/packages/vite/client.d.ts#L182
		this.#worker = new MediaWorker({ format: "es" })

		let sampleRate: number | undefined
		let channels: number | undefined

		for (const track of config.catalog.tracks) {
			if (isAudioTrack(track)) {
				if (sampleRate && track.selectionParams.samplerate !== sampleRate) {
					throw new Error(`TODO multiple audio tracks with different sample rates`)
				}
				sampleRate = track.selectionParams.samplerate
				// TODO properly handle weird channel configs
				channels = Math.max(+track.selectionParams.channelConfig, channels ?? 0)
			}
		}

		const msg: Message.Config = {}

		// Only configure audio is we have an audio track
		if (sampleRate && channels) {
			msg.audio = {
				channels: channels,
				sampleRate: sampleRate,
				ring: new RingShared(2, sampleRate / 10), // 100ms
			}
		}

		// TODO only send the canvas if we have a video track
		msg.video = {
			canvas: config.canvas,
		}

		this.send({ config: msg }, msg.video.canvas)
	}

	async play() {}

	init(init: Init) {
		this.send({ init })
	}

	segment(segment: Message.Segment) {
		this.send({ segment }, segment.stream)
	}

	async close() {
		this.#worker.terminate()
	}

	// Enforce we're sending valid types to the worker
	private send(msg: Message.ToWorker, ...transfer: Transferable[]) {
		this.#worker.postMessage(msg, transfer)
	}
}

export interface Init {
	name: string // name of the init track
	data: Uint8Array
}
