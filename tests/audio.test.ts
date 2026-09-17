import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUES, type Tone } from '../src/game/audio';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function span(tones: readonly Tone[]) {
  const hz = tones.map((tone) => tone.hz);
  const end = Math.max(...tones.map((tone) => tone.offset + tone.length));
  const waves = new Set(tones.map((tone) => tone.wave ?? 'sine'));
  return {
    minHz: Math.min(...hz),
    maxHz: Math.max(...hz),
    first: hz[0]!,
    last: hz[hz.length - 1]!,
    end,
    waves,
    rising: hz[hz.length - 1]! > hz[0]!,
    falling: hz[hz.length - 1]! < hz[0]!,
  };
}

describe('shared play cues', () => {
  it('keeps move, win, and fail mutually distinct', () => {
    const move = span(CUES.move);
    const win = span(CUES.win);
    const fail = span(CUES.fail);
    const collect = span(CUES.collect);

    expect(move.end).toBeLessThan(0.16);
    expect(move.waves.has('triangle')).toBe(true);
    expect(move.waves.has('square')).toBe(false);
    expect(move.rising).toBe(true);

    expect(win.end).toBeGreaterThan(0.7);
    expect(win.maxHz).toBeGreaterThan(move.maxHz);
    expect(win.rising).toBe(true);
    expect(win.waves.has('square')).toBe(false);
    expect(CUES.win.length).toBeGreaterThan(CUES.move.length);

    expect(fail.falling).toBe(true);
    expect(fail.waves.has('square')).toBe(true);
    expect(fail.minHz).toBeLessThan(move.minHz);
    expect(fail.maxHz).toBeLessThan(win.maxHz);
    expect(CUES.fail.every((tone) => tone.glide && tone.glide < tone.hz)).toBe(true);

    expect(collect.end).toBeGreaterThan(move.end);
    expect(collect.end).toBeLessThan(win.end);
    expect(collect.rising).toBe(true);
    expect(collect.waves.has('square')).toBe(false);
  });

  it('synthesizes locally and never loads remote or file audio', () => {
    const audio = readFileSync(join(root, 'src/game/audio.ts'), 'utf8');
    expect(audio).toContain('createOscillator');
    expect(audio).not.toMatch(/https?:\/\//);
    expect(audio).not.toMatch(/new Audio\(|\.(mp3|wav|ogg|m4a)\b/);
  });

  it('wires picnic/brush maze play and delivery through the same cues and mute chrome', () => {
    const maze = readFileSync(join(root, 'src/composables/useMazePlay.ts'), 'utf8');
    const delivery = readFileSync(join(root, 'src/components/DeliveryPlay.vue'), 'utf8');
    const mazePlay = readFileSync(join(root, 'src/components/MazePlay.vue'), 'utf8');

    for (const source of [maze, delivery]) {
      expect(source).toContain("playCue(soundOn.value, 'move')");
      expect(source).toContain("playCue(soundOn.value, 'win')");
      expect(source).toContain("playCue(soundOn.value, 'fail')");
      expect(source).toContain('usePlayAudio');
    }

    expect(mazePlay).toContain("soundOn ? '關閉音效' : '開啟音效'");
    expect(delivery).toContain("soundOn ? '關閉音效' : '開啟音效'");
    expect(delivery).toContain('#i-sound');
    expect(delivery).toContain('#i-muted');

    const sticker = readFileSync(join(root, 'src/components/StickerPlay.vue'), 'utf8');
    expect(sticker).toContain('usePlayAudio');
    expect(sticker).toContain("soundOn ? '關閉音效' : '開啟音效'");
    expect(sticker).toContain('speakEnglish');
    expect(sticker).toContain('#i-sound');
    expect(sticker).not.toMatch(/speak\(soundOn\.value,\s*id\)/);
  });
});

describe('mute gates synthesis and speech', () => {
  const created: Array<{ type: string; hz: number[]; glide: number[] }> = [];
  const speech = {
    getVoices: () => [{ lang: 'zh-HK', name: 'Sinji' } as SpeechSynthesisVoice],
    cancel: vi.fn(),
    speak: vi.fn(),
    addEventListener: vi.fn(),
  };

  beforeEach(async () => {
    created.length = 0;
    speech.cancel.mockReset();
    speech.speak.mockReset();

    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator() {
        const hz: number[] = [];
        const glide: number[] = [];
        const osc = {
          type: 'sine',
          frequency: {
            value: 0,
            setValueAtTime(value: number) { hz.push(value); },
            exponentialRampToValueAtTime(value: number) { glide.push(value); },
          },
          connect() {},
          disconnect() {},
          start() {},
          stop() {},
          onended: null as (() => void) | null,
        };
        created.push({ get type() { return osc.type; }, hz, glide });
        return osc;
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }
      resume() { return Promise.resolve(); }
      suspend() { return Promise.resolve(); }
    }

    vi.resetModules();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('webkitAudioContext', FakeAudioContext);
    vi.stubGlobal('speechSynthesis', speech);
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      voice = null;
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      constructor(public text: string) {}
    });
    vi.stubGlobal('window', {
      AudioContext: FakeAudioContext,
      webkitAudioContext: FakeAudioContext,
      speechSynthesis: speech,
    });
  });

  it('plays nothing when sound is off, including narration', async () => {
    const { playCue, speak, initAudio } = await import('../src/game/audio');
    initAudio(false);
    playCue(false, 'move');
    playCue(false, 'win');
    playCue(false, 'fail');
    speak(false, '已到達公園。');
    expect(created).toEqual([]);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('unlocks Web Audio on a user gesture and uses distinct move/win/fail waves', async () => {
    const { playCue, speak, cancelSpeech } = await import('../src/game/audio');
    playCue(true, 'move');
    const moveWaves = created.map((item) => item.type);
    created.length = 0;
    playCue(true, 'win');
    const winHz = created.flatMap((item) => item.hz);
    created.length = 0;
    playCue(true, 'fail');
    const failWaves = created.map((item) => item.type);
    const failGlide = created.flatMap((item) => item.glide);

    expect(moveWaves.every((wave) => wave === 'triangle')).toBe(true);
    expect(Math.max(...winHz)).toBeGreaterThan(1200);
    expect(failWaves.every((wave) => wave === 'square')).toBe(true);
    expect(failGlide.length).toBeGreaterThan(0);

    speak(true, '聲音已開啟。');
    expect(speech.speak).toHaveBeenCalledOnce();
    cancelSpeech();
    expect(speech.cancel).toHaveBeenCalled();
  });

  it('reads English words with an English voice and never assigns Cantonese', async () => {
    speech.getVoices = () => [
      { lang: 'zh-HK', name: 'Sinji' } as SpeechSynthesisVoice,
      { lang: 'en-US', name: 'Samantha' } as SpeechSynthesisVoice,
    ];
    const { speakEnglish } = await import('../src/game/audio');
    speakEnglish(true, 'burger');
    expect(speech.speak).toHaveBeenCalledOnce();
    const uttered = speech.speak.mock.calls[0]![0] as SpeechSynthesisUtterance;
    expect(uttered.text).toBe('burger');
    expect(uttered.lang).toMatch(/^en/i);
    expect(uttered.voice?.lang).toMatch(/^en/i);
    expect(uttered.voice?.lang).not.toMatch(/zh-HK|yue/i);
  });

  it('does not attach a Cantonese voice when speaking English without an English voice', async () => {
    speech.getVoices = () => [{ lang: 'zh-HK', name: 'Sinji' } as SpeechSynthesisVoice];
    const { speakEnglish } = await import('../src/game/audio');
    speakEnglish(true, 'car');
    expect(speech.speak).toHaveBeenCalledOnce();
    const uttered = speech.speak.mock.calls[0]![0] as SpeechSynthesisUtterance;
    expect(uttered.text).toBe('car');
    expect(uttered.lang).toMatch(/^en/i);
    expect(uttered.voice).toBeNull();
  });
});
