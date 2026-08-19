/**
 * ConectaFone - Audio Capture Engine
 * Captura TODO o som do PC com máxima fidelidade e zero perda
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
   * Captura de Áudio do Sistema (com resiliência a restrições de SO e superfícies)
   */
  async startSystemAudioCapture(onEndedCallback) {
    this.stopCapture();

    const isMobile = ScreenAudioCapture.isMobileDevice();

    // No Mobile, getDisplayMedia com áudio interno não é suportado pelo SO.
    // Redireciona diretamente para o modo de áudio otimizado de dispositivo.
    if (isMobile) {
      console.warn('[Capture] Dispositivo móvel detectado. Ativando Modo Áudio HD (Microfone/Linha).');
      return this.startDeviceAudioCapture(null, onEndedCallback);
    }

    let rawStream = null;

    // Tenta 1: Constraints completas e compatíveis com Chrome/Edge/Opera
    try {
      const displayConstraints = {
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        systemAudio: 'include',
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'exclude',
        monitorTypeSurfaces: 'include',
        suppressLocalAudioPlayback: false
      };
      console.log('[Capture] Tentando captura com constraints completas...');
      rawStream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);
    } catch (err) {
      console.warn('[Capture] Fallback 1 falhou:', err.name, err.message);
      
      // Tenta 2: Constraints mínimas (compatibilidade mais ampla)
      try {
        console.log('[Capture] Tentando fallback de constraints mínimas...');
        rawStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
      } catch (err2) {
        console.warn('[Capture] Fallback 2 falhou:', err2.name, err2.message);
        
        // Tenta 3: Apenas vídeo (depois verifica se tem áudio disponível)
        try {
          console.log('[Capture] Tentando captura apenas com vídeo...');
          rawStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
          });
        } catch (err3) {
          console.error('[Capture] Todas as tentativas de captura falharam:', err3);
          throw new Error('Could not start audio source: ' + (err3.message || err3.name));
        }
      }
    }

    const audioTracks = rawStream.getAudioTracks();

    // Verificação de superfície sem áudio (ex: Usuário selecionou "Janela" ou desmarcou a caixa)
    if (audioTracks.length === 0) {
      rawStream.getTracks().forEach(t => t.stop());
      const error = new Error('SURFACE_WITHOUT_AUDIO');
      error.code = 'SURFACE_WITHOUT_AUDIO';
      throw error;
    }

    this.stream = rawStream;
    this.audioTrack = audioTracks[0];
    
    console.log('[Capture] Áudio track obtida:', this.audioTrack);
    console.log('[Capture] Track enabled:', this.audioTrack.enabled);
    console.log('[Capture] Track readyState:', this.audioTrack.readyState);
    console.log('[Capture] Track settings:', this.audioTrack.getSettings());
    
    // Paramos a track de vídeo imediatamente se não for necessária para economizar banda/bateria
    const videoTracks = rawStream.getVideoTracks();
    if (videoTracks.length > 0) {
      this.videoTrack = videoTracks[0];
      // Mantemos a track de vídeo ativa em background apenas para monitorar evento de cancelamento da barra
      this.videoTrack.onended = () => {
        console.log('[Capture] Track de vídeo encerrada pelo usuário');
        this.stopCapture();
        if (onEndedCallback) onEndedCallback();
      };
    }

    this.audioTrack.onended = () => {
      console.log('[Capture] Track de áudio encerrada');
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

    // Cria MediaStream direto com a faixa de áudio original do Windows
    const cleanAudioStream = new MediaStream([this.audioTrack]);

    return {
      stream: cleanAudioStream,
      analyser: this.analyser,
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
      console.log('[Capture] Tentando captura com constraints Studio HD...');
      rawStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('[Capture] Fallback 1 falhou:', err.name, err.message);
      
      // Tenta 2: Constraints permissivas
      try {
        console.log('[Capture] Tentando fallback para getUserMedia básico...');
        rawStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err2) {
        console.error('[Capture] Todas as tentativas de captura de dispositivo falharam:', err2);
        throw new Error('Could not start audio source: ' + (err2.message || err2.name));
      }
    }

    const audioTracks = rawStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('NO_AUDIO_DEVICE_FOUND');
    }

    this.stream = rawStream;
    this.audioTrack = audioTracks[0];

    console.log('[Capture] Áudio track de dispositivo obtida:', this.audioTrack);
    console.log('[Capture] Track enabled:', this.audioTrack.enabled);
    console.log('[Capture] Track readyState:', this.audioTrack.readyState);
    console.log('[Capture] Track settings:', this.audioTrack.getSettings());

    this.audioTrack.onended = () => {
      console.log('[Capture] Track de áudio de dispositivo encerrada');
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
