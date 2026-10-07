// WebCodecs fallback type declarations if not present in ambient DOM types
declare class AudioDecoder {
  constructor(init: {
    output: (output: AudioData) => void;
    error: (error: DOMException | Error) => void;
  });
  readonly state: 'unconfigured' | 'configured' | 'closed';
  configure(config: {
    codec: string;
    sampleRate: number;
    numberOfChannels: number;
    description?: any;
  }): void;
  decode(chunk: EncodedAudioChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
  static isConfigSupported(config: any): Promise<{ supported: boolean; config: any }>;
}

declare class AudioData {
  readonly format: string;
  readonly sampleRate: number;
  readonly numberOfFrames: number;
  readonly numberOfChannels: number;
  readonly duration: number;
  readonly timestamp: number;
  allocationSize(options: { planeIndex: number; frameOffset?: number; frameCount?: number }): number;
  copyTo(
    destination: BufferSource,
    options: {
      planeIndex: number;
      frameOffset?: number;
      frameCount?: number;
      format?: string;
    }
  ): void;
  clone(): AudioData;
  close(): void;
}

declare class EncodedAudioChunk {
  constructor(init: {
    type: 'key' | 'delta';
    timestamp: number;
    duration?: number;
    data: any;
  });
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;
  copyTo(destination: BufferSource): void;
}

export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private volume: number = 1.0;
  private isMuted: boolean = false;
  private codec: string;
  private sampleRate: number;
  private channels: number;
  private decoder: AudioDecoder | null = null;
  private isDecoderConfigured: boolean = false;
  private nextStartTime: number = 0;
  private autoplayListenersAttached: boolean = false;
  private boundResume: () => void;

  constructor(codec: string = 'opus', sampleRate: number = 48000, channels: number = 2) {
    this.codec = codec.trim().toLowerCase().replace(/^\0+/, '');
    this.sampleRate = sampleRate || 48000;
    this.channels = channels || 2;
    this.boundResume = () => {
      this.resume();
    };

    this.initAudioContext();
    this.setupAutoplayUnlock();
    if (this.isEncodedCodec()) {
      this.initWebCodecsDecoder();
    }
  }

  private isEncodedCodec(): boolean {
    return this.codec !== 'raw' && this.codec !== 'pcm';
  }

  private initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        console.warn('AudioContext is not supported in this environment');
        return;
      }
      this.ctx = new AudioCtx({ sampleRate: this.sampleRate });
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);
    } catch (err) {
      console.warn('Failed to initialize AudioContext:', err);
    }
  }

  private setupAutoplayUnlock() {
    if (typeof window === 'undefined') return;
    const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
    events.forEach((evt) => {
      window.addEventListener(evt, this.boundResume, { once: true, passive: true });
    });
    this.autoplayListenersAttached = true;
  }

  private removeAutoplayUnlock() {
    if (!this.autoplayListenersAttached || typeof window === 'undefined') return;
    const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
    events.forEach((evt) => {
      window.removeEventListener(evt, this.boundResume);
    });
    this.autoplayListenersAttached = false;
  }

  public async resume(): Promise<void> {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('AudioContext resume failed:', err);
      }
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode && this.ctx) {
      const currentGain = this.isMuted ? 0 : this.volume;
      this.gainNode.gain.setValueAtTime(currentGain, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.gainNode && this.ctx) {
      const currentGain = this.isMuted ? 0 : this.volume;
      this.gainNode.gain.setValueAtTime(currentGain, this.ctx.currentTime);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  private initWebCodecsDecoder() {
    if (typeof AudioDecoder === 'undefined') {
      console.warn('WebCodecs AudioDecoder is not supported in this runtime.');
      return;
    }

    try {
      this.decoder = new AudioDecoder({
        output: (audioData: AudioData) => {
          this.handleDecodedAudioData(audioData);
        },
        error: (err) => {
          console.warn('WebCodecs AudioDecoder error:', err);
        },
      });
    } catch (e) {
      console.warn('Failed to create WebCodecs AudioDecoder:', e);
    }
  }

  private handleDecodedAudioData(audioData: AudioData) {
    if (!this.ctx || this.ctx.state === 'closed') {
      audioData.close();
      return;
    }

    const channels = audioData.numberOfChannels || this.channels;
    const frames = audioData.numberOfFrames;
    const sampleRate = audioData.sampleRate || this.sampleRate;

    const audioBuffer = this.ctx.createBuffer(channels, frames, sampleRate);

    let copySuccess = false;
    try {
      for (let ch = 0; ch < channels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        audioData.copyTo(channelData, { planeIndex: ch, format: 'f32-planar' });
      }
      copySuccess = true;
    } catch {
      // Fallback: try interleaved f32 copy
      try {
        const totalSamples = frames * channels;
        const interleaved = new Float32Array(totalSamples);
        audioData.copyTo(interleaved, { planeIndex: 0, format: 'f32' });
        const left = audioBuffer.getChannelData(0);
        const right = channels > 1 ? audioBuffer.getChannelData(1) : null;
        for (let i = 0; i < frames; i++) {
          left[i] = interleaved[i * channels];
          if (right) {
            right[i] = interleaved[i * channels + 1];
          }
        }
        copySuccess = true;
      } catch (err) {
        console.warn('Failed copying AudioData to AudioBuffer:', err);
      }
    }

    audioData.close();

    if (copySuccess) {
      this.playAudioBuffer(audioBuffer);
    }
  }

  private handleRawPcm(payload: Uint8Array) {
    if (!this.ctx || this.ctx.state === 'closed') return;

    // 16-bit signed integer LE PCM, 2 channels
    const bytesPerFrame = this.channels * 2;
    const validLength = payload.byteLength - (payload.byteLength % bytesPerFrame);
    if (validLength <= 0) return;

    const int16Array = new Int16Array(
      payload.buffer,
      payload.byteOffset,
      validLength / 2
    );
    const frameCount = int16Array.length / this.channels;

    const audioBuffer = this.ctx.createBuffer(this.channels, frameCount, this.sampleRate);
    const left = audioBuffer.getChannelData(0);
    const right = this.channels > 1 ? audioBuffer.getChannelData(1) : null;

    for (let i = 0; i < frameCount; i++) {
      left[i] = int16Array[i * this.channels] / 32768.0;
      if (right) {
        right[i] = int16Array[i * this.channels + 1] / 32768.0;
      }
    }

    this.playAudioBuffer(audioBuffer);
  }

  private playAudioBuffer(audioBuffer: AudioBuffer) {
    if (!this.ctx || this.ctx.state === 'closed' || !this.gainNode) return;

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const now = this.ctx.currentTime;
    // Jitter buffer and drift alignment:
    if (this.nextStartTime < now) {
      // Buffer underrun or initial playback start: add 20ms lead time to avoid click/glitch
      this.nextStartTime = now + 0.02;
    } else if (this.nextStartTime - now > 0.25) {
      // Excessive buffer queue lag (>250ms): resync to keep real-time audio with video
      this.nextStartTime = now + 0.03;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  public feedAudio(payload: Uint8Array, pts: number, isConfig: boolean) {
    if (!payload || payload.byteLength === 0) return;

    if (!this.isEncodedCodec()) {
      this.handleRawPcm(payload);
      return;
    }

    if (!this.decoder) {
      this.initWebCodecsDecoder();
      if (!this.decoder) return;
    }

    try {
      if (isConfig) {
        const codecString = this.codec === 'aac' ? 'mp4a.40.2' : 'opus';
        this.decoder.configure({
          codec: codecString,
          sampleRate: this.sampleRate,
          numberOfChannels: this.channels,
          description: payload as any,
        });
        this.isDecoderConfigured = true;
        return;
      }

      if (!this.isDecoderConfigured) {
        const codecString = this.codec === 'aac' ? 'mp4a.40.2' : 'opus';
        this.decoder.configure({
          codec: codecString,
          sampleRate: this.sampleRate,
          numberOfChannels: this.channels,
        });
        this.isDecoderConfigured = true;
      }

      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: pts,
        data: payload as any,
      });
      this.decoder.decode(chunk);

    } catch (err) {
      console.warn('feedAudio decode error:', err);
    }
  }

  public destroy() {
    this.removeAutoplayUnlock();
    if (this.decoder) {
      try {
        this.decoder.close();
      } catch {}
      this.decoder = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
    }
    this.gainNode = null;
  }
}
