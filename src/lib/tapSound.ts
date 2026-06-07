import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { GestureResponderEvent } from 'react-native';

const TAP_SOUND = require('../../assets/sounds/tap.mp3');
const TAP_RELEASE_MS = 250;

let audioModeReady = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  });
  audioModeReady = true;
}

/** Short tap feedback — new player each press so replay always works. */
export function playTapSound(): void {
  void (async () => {
    try {
      await ensureAudioMode();
      const player = createAudioPlayer(TAP_SOUND, { keepAudioSessionActive: true });
      player.volume = 0.85;
      player.play();
      setTimeout(() => {
        try {
          player.remove();
        } catch {
          // Player may already be released.
        }
      }, TAP_RELEASE_MS);
    } catch (err) {
      if (__DEV__) {
        console.warn('[tapSound] Could not play tap sound:', err);
      }
    }
  })();
}

type PressHandler = ((event: GestureResponderEvent) => void) | null | undefined;

/** Wrap a press handler with tap sound (skip for Google login via `silent` on AcidButton). */
export function withTapSound(handler?: PressHandler): (event: GestureResponderEvent) => void {
  return (event) => {
    playTapSound();
    handler?.(event);
  };
}

/** Preload audio session early so the first tap is instant. */
export function preloadTapSound(): void {
  void ensureAudioMode();
}
