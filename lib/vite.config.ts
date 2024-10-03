import { defineConfig } from "vite"

export default defineConfig({
	build: {
		lib: {
			entry: "./playback/index.ts",
			name: "@rmallick6806/moq-ts",
			fileName: (format) => `moq-ts.${format}.js`,
		},
	},
})
