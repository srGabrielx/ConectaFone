/**
 * Captura o áudio do sistema preservando a track original
 * para transmissão WebRTC em alta qualidade.
 */

export class ScreenAudioCapture {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.stream = null;
    this.audioTrack = null;
    this.videoTrack = null;
    this.analyser = null;
  }

  /**
   * Detecta se o ambiente de execução é Mobile
   */
  static isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || navigator.vendor || window.opera);
  }

  /**
   * Retorna as constraints padrão de áudio Studio HD (Sem filtros de voz/AEC)
   */
  static getStudioAudioConstraints(deviceId = null) {
    return {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {})
    };
  }

  /**
   * Captura de Áudio do Sistema (usando getDisplayMedia direto)
   */
  async startSystemAudioCapture(onEndedCallback) {
    this.stopCapture();

    // Usa getDisplayMedia com hints avançados para captura de áudio global do sistema
    let rawStream = null;

    try {
      const displayConstraints = {
        video: { displaySurface: "monitor" },
        audio: true, 
        systemAudio: "include",
        surfaceSwitching: "include",
        selfBrowserSurface: "exclude"
      };
      console.log('[CAPTURE] Solicitando captura de tela/sistema com constraints simplificadas...');
      rawStream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);
    } catch (err) {
      console.error('[CAPTURE] Erro ao abrir seleção de tela/áudio:', err.name, err.message);
      throw err;
    }

    const videoTrack = rawStream.getVideoTracks()[0];
    const audioTrack = rawStream.getAudioTracks()[0];
    const surface = videoTrack?.getSettings()?.displaySurface;
    
    if (surface !== 'monitor') {
      rawStream.getTracks().forEach(t => t.stop());
      const error = new Error('SYSTEM_AUDIO_REQUIRES_MONITOR');
      error.code = 'SYSTEM_AUDIO_REQUIRES_MONITOR';
      throw error;
    }

    console.table({
      fallback: false,
      surface: surface,
      audioLabel: audioTrack?.label,
      audioId: audioTrack?.id,
      channels: audioTrack?.getSettings()?.channelCount,
      sampleRate: audioTrack?.getSettings()?.sampleRate,
      audioReady: audioTrack?.readyState,
      audioMuted: audioTrack?.muted
    });

    // Verificação de áudio compartilhado
    if (!audioTrack) {
      console.warn('[Capture] Nenhuma track de áudio obtida - usuário não marcou compartilhar áudio');
      rawStream.getTracks().forEach(t => t.stop());
      const error = new Error("SYSTEM_AUDIO_NOT_SHARED");
      error.code = "SYSTEM_AUDIO_NOT_SHARED";
      if (ScreenAudioCapture.isMobileDevice()) {
        error.message = "Captura de áudio do sistema não suportada neste dispositivo.";
        error.code = "MOBILE_AUDIO_UNSUPPORTED";
      }
      throw error;
    }

    this.stream = rawStream;
    this.videoTrack = videoTrack;
    this.audioTrack = audioTrack;
    
    console.log('[SYSTEM AUDIO REAL]', {
      id: this.audioTrack.id,
      label: this.audioTrack.label,
      settings: this.audioTrack.getSettings(),
      constraints: this.audioTrack.getConstraints()
    });
    
    this.audioTrack.enabled = true;

    // Mantemos a captura original viva (videoTrack ativo) apenas para controle de encerramento
    if (this.videoTrack) {
      this.videoTrack.onended = () => {
        this.stopCapture();
        if (onEndedCallback) onEndedCallback();
      };
    }

    this.audioTrack.onended = () => {
      this.stopCapture();
      if (onEndedCallback) onEndedCallback();
    };

    // Conecta ao analisador visual do PC
    try {
      const ctx = await this.audioEngine.ensureContext();
      const source = ctx.createMediaStreamSource(new MediaStream([this.audioTrack]));
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);
    } catch (e) {
      console.warn('[Analyser Attach Error]:', e);
    }

    // A sala recebe EXCLUSIVAMENTE áudio limpo, enquanto o vídeo pode ser renderizado localmente
    const systemAudioStream = new MediaStream([this.audioTrack]);
    const videoStream = this.videoTrack ? new MediaStream([this.videoTrack]) : null;

    return {
      stream: systemAudioStream,
      videoStream: videoStream,
      analyser: this.analyser,
      captureSurface: surface,
      isSystemAudio: true,
      isMobileFallback: false
    };
  }

  /**
   * Captura via Dispositivo (Mixagem Estéreo / Placa de Som)
   */
  async startDeviceAudioCapture(deviceId = null, onEndedCallback = null) {
    this.stopCapture();

    let rawStream = null;
    
    // Tenta 1: Constraints Studio HD
    try {
      const constraints = {
        audio: ScreenAudioCapture.getStudioAudioConstraints(deviceId),
        video: false
      };
      rawStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw err;
      }
      // Tenta 2: Constraints permissivas básicas
      try {
        rawStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err2) {
        throw err2;
      }
    }

    const audioTracks = rawStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('NO_AUDIO_DEVICE_FOUND');
    }

    this.stream = rawStream;
    this.audioTrack = audioTracks[0];

    this.audioTrack.onended = () => {
      this.stopCapture();
      if (onEndedCallback) onEndedCallback();
    };

    try {
      const ctx = await this.audioEngine.ensureContext();
      const source = ctx.createMediaStreamSource(rawStream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);
    } catch (e) {}

    const cleanAudioStream = new MediaStream([this.audioTrack]);

    return {
      stream: cleanAudioStream,
      analyser: this.analyser,
      isMobileFallback: ScreenAudioCapture.isMobileDevice()
    };
  }

  stopCapture() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => {
        try { t.stop(); } catch (e) {}
      });
      this.stream = null;
    }
    this.audioTrack = null;
    this.videoTrack = null;
    this.analyser = null;
  }
}
