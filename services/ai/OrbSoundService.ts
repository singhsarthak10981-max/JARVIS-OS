export interface SoundConfig {
  enabled: boolean;
  volume: number;
}

export type SoundEvent =
  | "state-change"
  | "boot"
  | "error"
  | "notification";

let config: SoundConfig = {
  enabled: false,
  volume: 75,
};

export function configure(configOverride: Partial<SoundConfig>): void {
  config = { ...config, ...configOverride };
}

export function getConfig(): SoundConfig {
  return { ...config };
}

export function play(_event: SoundEvent): void {
  if (!config.enabled) return;
  // Placeholder — implement sound playback here
}

export function stop(): void {
  // Placeholder — implement sound stop here
}
