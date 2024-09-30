import { Frame, Component } from "./timeline"
import * as MP4 from "../../media/mp4"
import * as Message from "./message"

export class Renderer {
	#canvas: OffscreenCanvas
	#timeline: Component

	#decoder!: VideoDecoder
	#queue: TransformStream
	// NEW: Added properties to track and limit queue size
	#queueSize: number = 0
	#maxQueueSize: number = 16

	constructor(config: Message.ConfigVideo, timeline: Component) {
		this.#canvas = config.canvas
		this.#timeline = timeline

		this.#queue = new TransformStream({
			start: this.#start.bind(this),
			transform: this.#transform.bind(this),
		})

		this.#run().catch(console.error)
	}

	async #run() {
		const reader = this.#timeline.frames.pipeThrough(this.#queue).getReader()
		for (;;) {
			const { value: frame, done } = await reader.read()
			if (done) break
			self.requestAnimationFrame(() => {
				this.#canvas.width = frame.displayWidth
				this.#canvas.height = frame.displayHeight
				const ctx = this.#canvas.getContext("2d")
				if (!ctx) throw new Error("failed to get canvas context")

				ctx.drawImage(frame, 0, 0, frame.displayWidth, frame.displayHeight)
				this.#decreaseQueueSize() // NEW: Decrease queue size after processing a frame
				frame.close()
			})
		}
	}

	#start(controller: TransformStreamDefaultController<VideoFrame>) {
		this.#decoder = new VideoDecoder({
			output: (frame: VideoFrame) => {
				// MODIFIED: Check queue size before enqueueing
				if (this.#queueSize < this.#maxQueueSize) {
					controller.enqueue(frame)
					this.#queueSize++
				} else {
					// NEW: Drop frame if queue is full
					console.warn("Queue full, dropping frame")
					frame.close()
				}
			},
			error: console.error,
		})
	}

	#transform(frame: Frame) {
		if (this.#decoder.state !== "configured") {
			const { sample, track } = frame

			const desc = sample.description
			const box = desc.avcC ?? desc.hvcC ?? desc.vpcC ?? desc.av1C
			if (!box) throw new Error(`unsupported codec: ${track.codec}`)

			const buffer = new MP4.Stream(undefined, 0, MP4.Stream.BIG_ENDIAN)
			box.write(buffer)
			const description = new Uint8Array(buffer.buffer, 8)

			if (!MP4.isVideoTrack(track)) throw new Error("expected video track")

			this.#decoder.configure({
				codec: track.codec,
				codedHeight: track.video.height,
				codedWidth: track.video.width,
				description,
				optimizeForLatency: true,
			})
		}

		const chunk = new EncodedVideoChunk({
			type: frame.sample.is_sync ? "key" : "delta",
			data: frame.sample.data,
			timestamp: frame.sample.dts / frame.track.timescale,
		})

		this.#decoder.decode(chunk)
	}

	// NEW: Method to decrease queue size
	#decreaseQueueSize() {
		if (this.#queueSize > 0) {
			this.#queueSize--
		}
	}
}
