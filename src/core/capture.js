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
   * Lista dispositivos de áudio disponíveis e filtra dispositivos de sistema (Stereo Mix, What U Hear, etc.)
   */
  static async getSystemAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      // Filtra dispositivos que provavelmente são de áudio do sistema
      const systemAudioDevices = audioInputs.filter(device => {
        const label = device.label.toLowerCase();
        return label.includes('stereo mix') || 
               label.includes('what u hear') || 
               label.includes('mixagem') ||
               label.includes('saida') ||
               label.includes('output') ||
               label.includes('wave out') ||
               label.includes('system audio');
      });

      return {
        all: audioInputs,
        system: systemAudioDevices,
        hasSystemAudio: systemAudioDevices.length > 0
      };
    } catch (err) {
      console.error('[Capture] Erro ao enumerar dispositivos:', err);
      return { all: [], system: [], hasSystemAudio: false };
    }
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
   * Captura de Áudio do Sistema (usando dispositivos de áudio do sistema - Stereo Mix, etc.)
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

    // Tenta capturar usando dispositivos de áudio do sistema (Stereo Mix, What U Hear, etc.)
    console.log('[Capture] Buscando dispositivos de áudio do sistema...');
    const devices = await ScreenAudioCapture.getSystemAudioDevices();
    
    if (devices.hasSystemAudio) {
      console.log('[Capture] Dispositivos de áudio do sistema encontrados:', devices.system.map(d => d.label));
      
      // Tenta usar o primeiro dispositivo de áudio do sistema encontrado
      try {
        const systemDeviceId = devices.system[0].deviceId;
        console.log('[Capture] Usando dispositivo de sistema:', devices.system[0].label);
        return this.startDeviceAudioCapture(systemDeviceId, onEndedCallback);
      } catch (err) {
        console.warn('[Capture] Falha ao usar dispositivo de sistema:', err);
      }
    } else {
      console.warn('[Capture] Nenhum dispositivo de áudio do sistema encontrado (Stereo Mix, What U Hear, etc.)');
      console.log('[Capture] Dispositivos disponíveis:', devices.all.map(d => d.label));
    }

    // Fallback: Tenta captura via getDisplayMedia (funciona apenas com guias do Chrome)
    console.log('[Capture] Tentando captura via getDisplayMedia (apenas guias)...');
    let rawStream = null;

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
      console.warn('[Capture] Fallback getDisplayMedia falhou:', err.name, err.message);
      
      // Se falhar, usa captura de dispositivo padrão
      console.log('[Capture] Usando captura de dispositivo padrão como fallback final...');
      return this.startDeviceAudioCapture(null, onEndedCallback);
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
