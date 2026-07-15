export type CaptureMode = 'text' | 'voice'

const DEFAULT_MODE_KEY = 'mindump-default-mode'

export function getDefaultCaptureMode(): CaptureMode {
  const stored = localStorage.getItem(DEFAULT_MODE_KEY)
  return stored === 'voice' ? 'voice' : 'text'
}

export function setDefaultCaptureMode(mode: CaptureMode): void {
  localStorage.setItem(DEFAULT_MODE_KEY, mode)
}
