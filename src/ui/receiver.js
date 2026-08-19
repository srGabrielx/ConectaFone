/**
 * ConectaFone PRO - Receiver UI Controller (Celular com Auto-Sincronização)
 */

import { AudioVisualizer } from '../core/visualizer.js';

export class ReceiverUI {
  constructor(audioEngine, webrtcManager, pwaManager) {
    this.audioEngine = audioEngine;
    this.webrtcManager = webrtcManager;
    this.pwaManager = pwaManager;

    this.rxRoomInput = document.getElementById('rxRoomInput');
    this.rxStartBtn = document.getElementById('rxStartBtn');
    this.rxStopBtn = document.getElementById('rxStopBtn');
    this.rxTestBeepBtn = document.getElementById('rxTestBeepBtn');
    this.rxAutoSyncBtn = document.getElementById('rxAutoSyncBtn');
    this.rxPresetMovie = document.getElementById('rxPresetMovie');
    this.rxPresetGaming = document.getElementById('rxPresetGaming');
    this.rxStartBox = document.getElementById('rxStartBox');
    this.rxActiveDashboard = document.getElementById('rxActiveDashboard');
    this.rxStatusMessage = document.getElementById('rxStatusMessage');
    this.rxLatencyText = document.getElementById('rxLatencyText');

    this.rxVolumeSlider = document.getElementById('rxVolumeSlider');
    this.rxVolumeVal = document.getElementById('rxVolumeVal');
    this.rxDelaySlider = document.getElementById('rxDelaySlider');
    this.rxDelayVal = document.getElementById('rxDelayVal');
    this.rxVisualizerCanvas = document.getElementById('rxVisualizerCanvas');

    this.visualizer = null;
    this.activeCall = null;
    this.dataConn = null;
    this.audioElement = null;
    this.statsInterval = null;
  }

  init() {
    this.setupSliders();
    this.setupEvents();
  }

  setRoomCode(code) {
    if (this.rxRoomInput) {
      this.rxRoomInput.value = code;
    }
  }

  setupSliders() {
    this.rxVolumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.rxVolumeVal.textContent = Math.round(val * 100) + '%';
      this.audioEngine.setVolume(val);
    });

    this.rxDelaySlider.addEventListener('input', (e) => {
      const ms = parseInt(e.target.value);
      this.updateDelayDisplay(ms);
      this.audioEngine.setDelay(ms);
    });
  }

  updateDelayDisplay(ms) {
    this.rxDelaySlider.value = ms;
    this.rxDelayVal.textContent = (ms >= 0 ? '+' : '') + ms + ' ms';
  }

  setupEvents() {
    this.rxStartBtn.addEventListener('click', () => this.startListening());
    this.rxStopBtn.addEventListener('click', () => this.stopListening());
    
    if (this.rxTestBeepBtn) {
      this.rxTestBeepBtn.addEventListener('click', () => {
        this.audioEngine.playTestBeep();
      });
    }

    if (this.rxAutoSyncBtn) {
      this.rxAutoSyncBtn.addEventListener('click', () => this.autoSynchronize());
    }

    if (this.rxPresetMovie) {
      this.rxPresetMovie.addEventListener('click', () => {
        this.updateDelayDisplay(-60);
        this.audioEngine.setDelay(-60);
      });
    }

    if (this.rxPresetGaming) {
      this.rxPresetGaming.addEventListener('click', () => {
        this.updateDelayDisplay(0);
        this.audioEngine.setDelay(0);
      });
    }
  }

  async autoSynchronize() {
    if (!this.activeCall || !this.activeCall.peerConnection) {
      this.updateDelayDisplay(0);
      this.audioEngine.setDelay(0);
      return;
    }

    try {
      const stats = await this.activeCall.peerConnection.getStats();
      let measuredJitterMs = 15;

      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          if (report.jitter) {
            measuredJitterMs = Math.round(report.jitter * 1000);
          }
        }
      });

      // Calibração perfeita: define compensação ideal
      const optimalDelay = Math.min(100, Math.max(0, measuredJitterMs));
      this.updateDelayDisplay(optimalDelay);
      this.audioEngine.setDelay(optimalDelay);

      if (this.rxAutoSyncBtn) {
        const originalText = this.rxAutoSyncBtn.innerHTML;
        this.rxAutoSyncBtn.innerHTML = `✓ Sincronizado (${measuredJitterMs}ms)`;
        setTimeout(() => {
          this.rxAutoSyncBtn.innerHTML = originalText;
        }, 2000);
      }
    } catch (e) {
      this.updateDelayDisplay(0);
      this.audioEngine.setDelay(0);
    }
  }

  startLatencyMonitor() {
    if (this.statsInterval) clearInterval(this.statsInterval);

    this.statsInterval = setInterval(async () => {
      if (!this.activeCall || !this.activeCall.peerConnection) return;
      try {
        const stats = await this.activeCall.peerConnection.getStats();
        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime) {
              const rttMs = Math.round(report.currentRoundTripTime * 1000);
              if (this.rxLatencyText) {
                this.rxLatencyText.textContent = `${rttMs} ms`;
              }
            }
          }
        });
      } catch (e) {}
    }, 2000);
  }

  async startListening() {
    const targetRoom = (this.rxRoomInput.value || '').trim().toUpperCase();
    if (!targetRoom) {
      alert("Por favor, digite o Código da Sala (ex: CF-1234) gerado no computador.");
      return;
    }

    try {
      // 1. Prepara contexto de áudio em resposta ao gesto de clique
      const ctx = await this.audioEngine.ensureContext();
      
      this.audioElement = document.getElementById('rxNativeAudioPlayer');
      if (!this.audioElement) {
        this.audioElement = document.createElement('audio');
        this.audioElement.id = 'rxNativeAudioPlayer';
        this.audioElement.autoplay = true;
        this.audioElement.playsInline = true;
        this.audioElement.setAttribute('playsinline', 'true');
        this.audioElement.setAttribute('webkit-playsinline', 'true');
        document.body.appendChild(this.audioElement);
      }

      // CRUCIAL: O elemento nativo fica MUTADO para evitar VOZ DUPLICADA / ECO
      // O som audível sai 100% pelo grafo Web Audio API (Master Gain + Delay)
      this.audioElement.muted = true;
      this.audioElement.volume = 0.0;

      const { inputNode, analyser } = this.audioEngine.setupReceiverPipeline(
        parseFloat(this.rxVolumeSlider.value),
        parseInt(this.rxDelaySlider.value)
      );

      // 2. Cria faixa de chamada ativa
      const callStream = this.audioEngine.createSilentStream();

      // 3. Conecta via WebRTC
      const { call, dataConn } = await this.webrtcManager.connectReceiver(
        targetRoom,
        callStream,
        async (remoteStream) => {
          console.log('[Receiver] Áudio recebido. Processando canal único limpo sem eco...');
          console.log('[Receiver] Stream recebido:', remoteStream);
          console.log('[Receiver] Tracks no stream:', remoteStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, label: t.label })));

          // O elemento nativo apenas recebe o stream para manter a decodificação ativa no OS
          this.audioElement.srcObject = remoteStream;
          try {
            await this.audioElement.play();
            console.log('[Receiver] Elemento de áudio nativo iniciado com sucesso');
          } catch (e) {
            console.error('[Receiver] Erro ao iniciar elemento de áudio nativo:', e);
          }

          // Conecta ÚNICA e EXCLUSIVAMENTE ao grafo Web Audio para som limpo sem duplicação
          try {
            const audioTracks = remoteStream.getAudioTracks();
            if (audioTracks.length > 0) {
              console.log('[Receiver] Conectando track de áudio ao grafo Web Audio...');
              const source = ctx.createMediaStreamSource(remoteStream);
              source.connect(inputNode);
              console.log('[Receiver] Conexão Web Audio estabelecida com sucesso');
            } else {
              console.warn('[Receiver] Nenhuma track de áudio encontrada no stream remoto');
            }
          } catch (err) {
            console.error('[Web Audio Graph Error]:', err);
          }

          // Atualiza UI
          this.rxStartBox.classList.add('hidden');
          this.rxActiveDashboard.classList.remove('hidden');
          this.rxActiveDashboard.classList.add('flex');

          this.pwaManager.requestWakeLock();
          this.pwaManager.setupMediaSession();

          // Monitor de latência em tempo real
          this.startLatencyMonitor();

          // Visualizador 60 FPS
          this.visualizer = new AudioVisualizer(this.rxVisualizerCanvas, analyser);
          this.visualizer.start();

          // Auto-Sincronização inicial automática
          setTimeout(() => this.autoSynchronize(), 800);
        },
        (msg) => {
          if (msg.type === 'HOST_STATUS') {
            if (this.rxStatusMessage) {
              if (msg.isTransmitting) {
                this.rxStatusMessage.textContent = '● Transmitindo Áudio do PC ao Vivo!';
                this.rxStatusMessage.className = 'text-sm font-bold text-green-neon flex items-center gap-1.5';
              } else {
                this.rxStatusMessage.textContent = '⏳ Conectado! Clique no PC em "TRANSMITIR TODO O SOM DO PC"';
                this.rxStatusMessage.className = 'text-sm font-bold text-amber-300 flex items-center gap-1.5';
              }
            }
          }
        },
        () => {
          this.stopListening();
        }
      );

      this.activeCall = call;
      this.dataConn = dataConn;

    } catch (err) {
      alert("Não foi possível conectar à sala " + targetRoom + ".\n\nVerifique se o computador está com o ConectaFone aberto na mesma sala.");
      console.error(err);
    }
  }

  stopListening() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    if (this.activeCall) {
      try { this.activeCall.close(); } catch (e) {}
      this.activeCall = null;
    }
    if (this.dataConn) {
      try { this.dataConn.close(); } catch (e) {}
      this.dataConn = null;
    }
    if (this.audioElement) {
      this.audioElement.srcObject = null;
    }
    if (this.visualizer) {
      this.visualizer.stop();
      this.visualizer = null;
    }
    this.pwaManager.releaseWakeLock();
    this.rxActiveDashboard.classList.add('hidden');
    this.rxActiveDashboard.classList.remove('flex');
    this.rxStartBox.classList.remove('hidden');
  }
}
