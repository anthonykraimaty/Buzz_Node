import { useCallback, useRef, useEffect } from 'react';
import { SoundEffect, BuzzerSound } from '../types';

export function useSounds() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundsEnabledRef = useRef(true);

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const playSound = useCallback((sound: SoundEffect) => {
    if (!soundsEnabledRef.current || !audioContextRef.current) return;

    try {
      // Create oscillator for different sounds
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Configure different sounds
      switch (sound) {
        case 'buzz':
          oscillator.frequency.setValueAtTime(880, ctx.currentTime);
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.3);
          break;

        case 'correct':
          oscillator.frequency.setValueAtTime(523, ctx.currentTime);
          oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.4);
          break;

        case 'wrong':
          oscillator.frequency.setValueAtTime(200, ctx.currentTime);
          oscillator.frequency.setValueAtTime(150, ctx.currentTime + 0.1);
          oscillator.type = 'sawtooth';
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.3);
          break;

        case 'tick':
          oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.05);
          break;

        case 'bomb-explode':
          oscillator.frequency.setValueAtTime(100, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);
          oscillator.type = 'sawtooth';
          gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.5);
          break;

        case 'bank':
          oscillator.frequency.setValueAtTime(440, ctx.currentTime);
          oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.3);
          break;

        case 'steal':
          oscillator.frequency.setValueAtTime(300, ctx.currentTime);
          oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(300, ctx.currentTime + 0.2);
          oscillator.type = 'triangle';
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.4);
          break;

        case 'round-start':
          oscillator.frequency.setValueAtTime(440, ctx.currentTime);
          oscillator.frequency.setValueAtTime(554, ctx.currentTime + 0.15);
          oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.3);
          oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.45);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.7);
          break;

        case 'round-end':
          oscillator.frequency.setValueAtTime(880, ctx.currentTime);
          oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
          oscillator.frequency.setValueAtTime(554, ctx.currentTime + 0.3);
          oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.45);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.7);
          break;

        case 'countdown':
          oscillator.frequency.setValueAtTime(1500, ctx.currentTime);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.8);
          break;

        case 'dramatic':
          oscillator.frequency.setValueAtTime(200, ctx.currentTime);
          oscillator.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.5);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.5);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 1);
          break;

        case 'game-over':
          // Play a triumphant fanfare
          const notes = [523, 659, 784, 1047];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.4);
            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.4);
          });
          return;
      }
    } catch (e) {
      console.error('Sound playback error:', e);
    }
  }, []);

  const setSoundsEnabled = useCallback((enabled: boolean) => {
    soundsEnabledRef.current = enabled;
  }, []);

  // Play player's custom buzzer sound
  const playBuzzerSound = useCallback((buzzerSound: BuzzerSound) => {
    if (!soundsEnabledRef.current || !audioContextRef.current) return;

    try {
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      switch (buzzerSound) {
        case 'buzz':
          // Classic buzzer
          oscillator.frequency.setValueAtTime(880, ctx.currentTime);
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.3);
          break;

        case 'bark':
          // Dog bark - low growl rising
          oscillator.frequency.setValueAtTime(150, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
          oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
          oscillator.type = 'sawtooth';
          gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.25);
          break;

        case 'horn':
          // Car horn - sustained note
          oscillator.frequency.setValueAtTime(350, ctx.currentTime);
          oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.02);
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.35, ctx.currentTime);
          gainNode.gain.setValueAtTime(0.35, ctx.currentTime + 0.3);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.4);
          break;

        case 'bell':
          // Bell ding
          oscillator.frequency.setValueAtTime(1200, ctx.currentTime);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.5);
          break;

        case 'whistle':
          // Whistle - high pitch rising
          oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.2);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.3);
          break;

        case 'airhorn':
          // Air horn - loud blast
          oscillator.frequency.setValueAtTime(380, ctx.currentTime);
          oscillator.type = 'sawtooth';
          gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
          gainNode.gain.setValueAtTime(0.4, ctx.currentTime + 0.4);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.5);
          break;

        case 'quack':
          // Duck quack - frequency wobble
          oscillator.frequency.setValueAtTime(350, ctx.currentTime);
          oscillator.frequency.setValueAtTime(280, ctx.currentTime + 0.05);
          oscillator.frequency.setValueAtTime(350, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(280, ctx.currentTime + 0.15);
          oscillator.type = 'sawtooth';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.25);
          break;

        case 'boing':
          // Boing - spring sound
          oscillator.frequency.setValueAtTime(600, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.35);
          break;

        case 'laser':
          // Laser zap - descending high pitch
          oscillator.frequency.setValueAtTime(2500, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.2);
          break;

        case 'pop':
          // Pop sound - short burst
          oscillator.frequency.setValueAtTime(500, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.05);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.08);
          break;

        default:
          // Default to classic buzz
          oscillator.frequency.setValueAtTime(880, ctx.currentTime);
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.error('Buzzer sound playback error:', e);
    }
  }, []);

  return { playSound, playBuzzerSound, setSoundsEnabled };
}
