import { defineConfig } from "vite"
import dtsPlugin from "vite-plugin-dts"

export default defineConfig({
	build: {
		lib: {
			entry: "./playback/index.ts",
			name: "@rmallick6806/moq-ts",
			fileName: (format) => `moq-ts.${format}.js`,
		},
	},
})
