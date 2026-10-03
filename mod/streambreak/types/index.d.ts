// F1 spike contract. F2 replaces it with the real PluginState.streambreak shape.
export type SpikeLog = string[]

declare module 'claude-code' {
  interface PluginState {
    streambreak: { spikeLog: SpikeLog }
  }
}
