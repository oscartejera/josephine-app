// KDS Sound System - Generates unique tones for each station using Web Audio API
// No external audio files needed

export type KDSStation = 'kitchen' | 'bar' | 'prep' | 'rush' | 'newOrder';

export interface KDSSoundSettings {
  enabled: boolean;
  volume: number; // 0-100
  kitchenEnabled: boolean;
  barEnabled: boolean;
  prepEnabled: boolean;
  rushEnabled: boolean;
  newOrderEnabled: boolean;
}

export const DEFAULT_SOUND_SETTINGS: KDSSoundSettings = {
  enabled: true,
  volume: 70,
  kitchenEnabled: true,
  barEnabled: true,
  prepEnabled: true,
  rushEnabled: true,
  newOrderEnabled: true,
};

// Sound configurations for each station
// Using different frequencies and patterns to create distinct sounds
const SOUND_CONFIGS: Record<KDSStation, { 
  frequencies: number[]; 
  durations: number[]; 
  type: OscillatorType;
  pattern: 'single' | 'double' | 'triple' | 'alarm';
}> = {
  kitchen: {
    // Deep, warm tone - like a kitchen bell
    frequencies: [440, 554], // A4, C#5
    durations: [150, 150],
    type: 'sine',
    pattern: 'double',
  },
  bar: {
    // Light, crisp tone - like a cocktail shaker
    frequencies: [880, 1047, 880], // A5, C6, A5
    durations: [100, 100, 100],
    type: 'triangle',
    pattern: 'triple',
  },
  prep: {
    // Mid-range, steady tone
    frequencies: [659], // E5
    durations: [200],
    type: 'sine',
    pattern: 'single',
  },
  rush: {
    // Urgent, pulsing alarm
    frequencies: [880, 698, 880, 698], // A5, F5 alternating
    durations: [100, 100, 100, 100],
    type: 'square',
    pattern: 'alarm',
  },
  newOrder: {
    // Pleasant chime for new orders
    frequencies: [523, 659, 784], // C5, E5, G5 (C major chord)
    durations: [120, 120, 200],
    type: 'sine',
    pattern: 'triple',
  },
};

class KDSSoundManager {
  private audioContext: AudioContext | null = null;
  private settings: KDSSoundSettings = DEFAULT_SOUND_SETTINGS;
  private isPlaying: boolean = false;

  constructor() {
    // Load settings from localStorage
    const stored = localStorage.getItem('kds-sound-settings');
    if (stored) {
      try {
        this.settings = { ...DEFAULT_SOUND_SETTINGS, ...JSON.parse(stored) };
      } catch (e) {
        console.error('Error loading sound settings:', e);
      }
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  updateSettings(newSettings: Partial<KDSSoundSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('kds-sound-settings', JSON.stringify(this.settings));
  }

  getSettings(): KDSSoundSettings {
    return { ...this.settings };
  }

  private isStationEnabled(station: KDSStation): boolean {
    switch (station) {
      case 'kitchen': return this.settings.kitchenEnabled;
      case 'bar': return this.settings.barEnabled;
      case 'prep': return this.settings.prepEnabled;
      case 'rush': return this.settings.rushEnabled;
      case 'newOrder': return this.settings.newOrderEnabled;
      default: return true;
    }
  }

  async playSound(station: KDSStation): Promise<void> {
    // Don't play if disabled or already playing
    if (!this.settings.enabled || this.isPlaying) return;
    if (!this.isStationEnabled(station)) return;

    const config = SOUND_CONFIGS[station];
    if (!config) return;

    this.isPlaying = true;

    try {
      const ctx = this.getAudioContext();
      const masterGain = ctx.createGain();
      masterGain.gain.value = this.settings.volume / 100;
      masterGain.connect(ctx.destination);

      let currentTime = ctx.currentTime;

      for (let i = 0; i < config.frequencies.length; i++) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = config.type;
        oscillator.frequency.value = config.frequencies[i];

        // Envelope for smooth sound
        const duration = config.durations[i] / 1000;
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, currentTime + 0.02);
        gainNode.gain.linearRampToValueAtTime(0.3, currentTime + duration * 0.5);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        oscillator.start(currentTime);
        oscillator.stop(currentTime + duration);

        // Add gap between notes for patterns
        currentTime += duration + 0.05;
      }

      // Wait for sound to complete
      const totalDuration = config.durations.reduce((a, b) => a + b, 0) + 
                           (config.durations.length - 1) * 50;
      await new Promise(resolve => setTimeout(resolve, totalDuration + 100));
    } catch (error) {
      console.error('Error playing KDS sound:', error);
    } finally {
      this.isPlaying = false;
    }
  }

  // Play a test sound
  async testSound(station: KDSStation): Promise<void> {
    const wasEnabled = this.settings.enabled;
    const wasStationEnabled = this.isStationEnabled(station);
    
    // Temporarily enable for test
    this.settings.enabled = true;
    switch (station) {
      case 'kitchen': this.settings.kitchenEnabled = true; break;
      case 'bar': this.settings.barEnabled = true; break;
      case 'prep': this.settings.prepEnabled = true; break;
      case 'rush': this.settings.rushEnabled = true; break;
      case 'newOrder': this.settings.newOrderEnabled = true; break;
    }

    await this.playSound(station);

    // Restore settings
    this.settings.enabled = wasEnabled;
    switch (station) {
      case 'kitchen': this.settings.kitchenEnabled = wasStationEnabled; break;
      case 'bar': this.settings.barEnabled = wasStationEnabled; break;
      case 'prep': this.settings.prepEnabled = wasStationEnabled; break;
      case 'rush': this.settings.rushEnabled = wasStationEnabled; break;
      case 'newOrder': this.settings.newOrderEnabled = wasStationEnabled; break;
    }
  }
}

// Singleton instance
export const kdsSoundManager = new KDSSoundManager();
