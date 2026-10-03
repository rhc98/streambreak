import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // mod/** tests import claude-code/testing and run under `claude plugin test` only
    exclude: [...configDefaults.exclude, 'mod/**'],
  },
})
