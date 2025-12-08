/**
 * AudioService - Sistema de sonidos para Beexoccer
 * - Ambiente de estadio (hinchada)
 * - Silbato de árbitro
 * - Grito de gol
 * - Efectos de colisión
 */

class AudioService {
  private audioContext: AudioContext | null = null;
  private crowdSource: AudioBufferSourceNode | null = null;
  private crowdGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private isMuted = false;
  private isInitialized = false;
  private crowdVolume = 0.15; // Volumen base de la hinchada (bajo para ser ambiente)

  // Inicializar el contexto de audio (debe llamarse tras interacción del usuario)
  async init() {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Crear gain master
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.audioContext.destination);
      
      // Crear gain para la hinchada
      this.crowdGain = this.audioContext.createGain();
      this.crowdGain.gain.value = this.crowdVolume;
      this.crowdGain.connect(this.masterGain);
      
      this.isInitialized = true;
      console.log('[AudioService] Initialized');
    } catch (err) {
      console.warn('[AudioService] Failed to initialize:', err);
    }
  }

  // Generar ruido de hinchada usando síntesis
  private createCrowdNoise(): AudioBufferSourceNode | null {
    if (!this.audioContext || !this.crowdGain) return null;

    // Crear buffer de ruido rosa (más natural que ruido blanco)
    const bufferSize = this.audioContext.sampleRate * 4; // 4 segundos de loop
    const buffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        
        // Filtro para ruido rosa (más cálido, como multitud)
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        
        // Modulación lenta para simular oleadas de la hinchada
        const modulation = 0.7 + 0.3 * Math.sin(i / (bufferSize / 8) * Math.PI * 2);
        
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05 * modulation;
        b6 = white * 0.115926;
      }
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    // Filtro pasa-bajos para suavizar
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    
    source.connect(filter);
    filter.connect(this.crowdGain);
    
    return source;
  }

  // Iniciar sonido ambiente de estadio
  startCrowdAmbience() {
    if (!this.isInitialized || this.isMuted) return;
    
    this.stopCrowdAmbience();
    this.crowdSource = this.createCrowdNoise();
    if (this.crowdSource) {
      this.crowdSource.start();
      console.log('[AudioService] Crowd ambience started');
    }
  }

  // Detener sonido ambiente
  stopCrowdAmbience() {
    if (this.crowdSource) {
      try {
        this.crowdSource.stop();
      } catch {
        // Ya estaba detenido
      }
      this.crowdSource = null;
    }
  }

  // Intensificar hinchada (cuando hay acción)
  intensifyCrowd(duration = 2000) {
    if (!this.crowdGain || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    this.crowdGain.gain.cancelScheduledValues(now);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, now);
    this.crowdGain.gain.linearRampToValueAtTime(this.crowdVolume * 2.5, now + 0.3);
    this.crowdGain.gain.linearRampToValueAtTime(this.crowdVolume, now + duration / 1000);
  }

  // Silbato del árbitro
  playWhistle() {
    if (!this.audioContext || !this.masterGain || this.isMuted) return;

    const now = this.audioContext.currentTime;
    
    // Crear oscilador para el silbato (frecuencia alta)
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    // Dos frecuencias para un silbato más realista
    osc1.frequency.setValueAtTime(2800, now);
    osc1.frequency.linearRampToValueAtTime(2600, now + 0.1);
    osc1.frequency.linearRampToValueAtTime(2800, now + 0.4);
    
    osc2.frequency.setValueAtTime(3200, now);
    osc2.frequency.linearRampToValueAtTime(3000, now + 0.1);
    osc2.frequency.linearRampToValueAtTime(3200, now + 0.4);
    
    osc1.type = 'sine';
    osc2.type = 'sine';
    
    // Envelope del silbato
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain.gain.setValueAtTime(0.25, now + 0.35);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
    
    // Conectar
    const merger = this.audioContext.createGain();
    merger.gain.value = 0.5;
    osc1.connect(merger);
    osc2.connect(merger);
    merger.connect(gain);
    gain.connect(this.masterGain);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
    
    console.log('[AudioService] Whistle played');
  }

  // Silbato doble (inicio/fin de partido)
  playDoubleWhistle() {
    this.playWhistle();
    setTimeout(() => this.playWhistle(), 600);
  }

  // Silbato triple (gol)
  playTripleWhistle() {
    this.playWhistle();
    setTimeout(() => this.playWhistle(), 400);
    setTimeout(() => this.playWhistle(), 800);
  }

  // Grito de GOL
  playGoalSound(isMyGoal: boolean) {
    if (!this.audioContext || !this.masterGain || this.isMuted) return;

    const now = this.audioContext.currentTime;
    
    // Intensificar la hinchada
    this.intensifyCrowd(4000);
    
    // Crear el "grito" sintético - múltiples osciladores con modulación
    const numVoices = 8;
    const baseFreq = isMyGoal ? 300 : 200; // Tono más alto para gol propio
    
    for (let i = 0; i < numVoices; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      
      // Frecuencia con variación para simular múltiples voces
      const freq = baseFreq + (Math.random() - 0.5) * 100;
      osc.frequency.setValueAtTime(freq, now);
      
      // Modulación de frecuencia para el "GOOOL"
      if (isMyGoal) {
        // "GOOOOOL" largo y ascendente
        osc.frequency.linearRampToValueAtTime(freq * 1.2, now + 0.5);
        osc.frequency.linearRampToValueAtTime(freq * 1.5, now + 1.5);
        osc.frequency.linearRampToValueAtTime(freq * 1.3, now + 2.5);
      } else {
        // Más corto y descendente para gol rival
        osc.frequency.linearRampToValueAtTime(freq * 0.9, now + 1);
      }
      
      osc.type = 'sawtooth';
      
      // Envelope
      const duration = isMyGoal ? 3 : 1.5;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.04, now + 0.1);
      gain.gain.setValueAtTime(0.08, now + duration * 0.7);
      gain.gain.linearRampToValueAtTime(0, now + duration);
      
      // Filtro para suavizar
      filter.type = 'lowpass';
      filter.frequency.value = 1500;
      filter.Q.value = 1;
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(now + Math.random() * 0.1);
      osc.stop(now + duration + 0.2);
    }
    
    // Añadir explosión de bombo para celebración
    if (isMyGoal) {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => this.playDrum(), i * 400);
      }
    }
    
    console.log('[AudioService] Goal sound played');
  }

  // Sonido de bombo (celebración)
  private playDrum() {
    if (!this.audioContext || !this.masterGain) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Sonido de colisión ficha-pelota
  playKick(power: number = 0.5) {
    if (!this.audioContext || !this.masterGain || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    // Frecuencia basada en la potencia
    const baseFreq = 100 + power * 100;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.1);
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.2 * power, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Sonido de colisión ficha-ficha
  playChipCollision() {
    if (!this.audioContext || !this.masterGain || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
    osc.type = 'triangle';
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Sonido de rebote en pared
  playWallBounce() {
    if (!this.audioContext || !this.masterGain || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Sonido de cambio de turno
  playTurnChange() {
    if (!this.audioContext || !this.masterGain || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.1);
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.15);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Sonido de timeout/advertencia
  playTimeout() {
    if (!this.audioContext || !this.masterGain || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    
    for (let i = 0; i < 3; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.frequency.setValueAtTime(440, now + i * 0.2);
      osc.type = 'square';
      
      gain.gain.setValueAtTime(0, now + i * 0.2);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.2 + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.2 + 0.15);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.15);
    }
  }

  // Sonido de victoria
  playVictory() {
    if (!this.audioContext || !this.masterGain || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      
      osc.frequency.setValueAtTime(freq, now + i * 0.15);
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.05);
      gain.gain.setValueAtTime(0.15, now + i * 0.15 + 0.2);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.4);
      
      osc.connect(gain);
      gain.connect(this.masterGain!);
      
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.5);
    });
    
    // Final chord
    setTimeout(() => {
      this.playTripleWhistle();
      this.intensifyCrowd(5000);
    }, 700);
  }

  // Sonido de derrota
  playDefeat() {
    if (!this.audioContext || !this.masterGain || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(150, now + 1);
    osc.type = 'sawtooth';
    
    // Filtro para suavizar
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 1.5);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 1.5);
  }

  // Mute/Unmute
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : 1;
    }
    
    if (this.isMuted) {
      this.stopCrowdAmbience();
    }
    
    return this.isMuted;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 1;
    }
    if (muted) {
      this.stopCrowdAmbience();
    }
  }

  isSoundMuted(): boolean {
    return this.isMuted;
  }

  // Limpiar recursos
  cleanup() {
    this.stopCrowdAmbience();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
  }
}

export const audioService = new AudioService();
