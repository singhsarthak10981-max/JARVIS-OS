"use client";

export interface ActiveTimer {
  id: string;
  label: string;
  duration: number;
  endsAt: number;
}

interface TimerRecord {
  info: ActiveTimer;
  timeout: ReturnType<typeof setTimeout>;
  onFire: () => void;
}

const timers = new Map<string, TimerRecord>();

export function startTimer(
  seconds: number,
  label: string,
  onFire: () => void
): ActiveTimer {
  const duration = Math.max(1, Math.round(seconds));
  const id = `timer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const info: ActiveTimer = {
    id,
    label,
    duration,
    endsAt: Date.now() + duration * 1000,
  };

  const timeout = setTimeout(() => {
    timers.delete(id);
    onFire();
  }, duration * 1000);

  timers.set(id, { info, timeout, onFire });
  return info;
}

export function cancelAllTimers(): number {
  const count = timers.size;
  for (const record of timers.values()) {
    clearTimeout(record.timeout);
  }
  timers.clear();
  return count;
}

export function listTimers(): ActiveTimer[] {
  return [...timers.values()]
    .map((record) => record.info)
    .sort((a, b) => a.endsAt - b.endsAt);
}

export function activeTimerCount(): number {
  return timers.size;
}
