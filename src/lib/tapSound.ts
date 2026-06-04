import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const TAP_SOUND = require('../../assets/sounds/tap.mp3');

let tapPlayer: AudioPlayer | null = null;
let loading: Promise<AudioPlayer | null> | null = null;

async function loadTapPlayer(): Promise<AudioPlayer | null> {
  if (tapPlayer) return tapPlayer;
  if (loading) return loading;

  loading = (async () => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      });
      const player = createAudioPlayer(TAP_SOUND, { keepAudioSessionActive: true });
      player.volume = 0.85;
      tapPlayer = player;
      return player;
    } catch (err) {
      if (__DEV__) {
        console.warn('[tapSound] Could not load tap sound:', err);
      }
      return null;
    } finally {
      loading = null;
    }
  })();

  return loading;
}

/** Short tap feedback for the log button (fire-and-forget). */
export function playTapSound(): void {
  void (async () => {
    const player = await loadTapPlayer();
    if (!player) return;

    try {
      if (player.isLoaded) {
        player.pause();
        await player.seekTo(0);
      }
      player.play();
    } catch (err) {
      if (__DEV__) {
        console.warn('[tapSound] Could not play tap sound:', err);
      }
    }
  })();
}

/** Preload on log screen mount so the first tap is instant. */
export function preloadTapSound(): void {
  void loadTapPlayer();
}
