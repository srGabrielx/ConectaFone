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
      
      // Controla volume diretamente no elemento de áudio
      if (this.audioElement) {
        this.audioElement.volume = val;
      }
      
      // Também controla no Web Audio para o visualizador
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
      console.log('[Receiver] Iniciando conexão com sala:', targetRoom);
      
      // Cria elemento de áudio simples e direto
      this.audioElement = document.getElementById('rxNativeAudioPlayer');
      if (!this.audioElement) {
        this.audioElement = document.createElement('audio');
        this.audioElement.id = 'rxNativeAudioPlayer';
        this.audioElement.autoplay = true;
        this.audioElement.controls = false;
        this.audioElement.volume = parseFloat(this.rxVolumeSlider.value);
        document.body.appendChild(this.audioElement);
      } else {
        this.audioElement.volume = parseFloat(this.rxVolumeSlider.value);
      }
      
      // Desbloqueia o elemento de áudio no iOS/Mobile durante o evento de clique síncrono
      try {
        this.audioElement.play().catch(() => {});
      } catch (e) {}

      // Prepara contexto de áudio para o visualizador apenas
      const ctx = await this.audioEngine.ensureContext();
      const { inputNode, analyser } = this.audioEngine.setupReceiverPipeline(
        parseFloat(this.rxVolumeSlider.value),
        parseInt(this.rxDelaySlider.value)
      );

      console.log('[Receiver] Conectando via WebRTC...');
      const { call, dataConn } = await this.webrtcManager.connectReceiver(
        targetRoom,
        null, // Sem stream inicial - apenas recebe áudio
        async (remoteStream) => {
          console.log('[RECEIVER] Stream recebido com sucesso!');
          console.log('[RECEIVER] Tracks:', remoteStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));

          // Diagnóstico da track recebida
          remoteStream.getTracks().forEach(track => {
            if (track.kind === 'audio') {
              console.log('[RECEIVER TRACK]', {
                kind: track.kind,
                label: track.label,
                muted: track.muted,
                readyState: track.readyState
              });
            }
          });

          // Verifica se o stream tem áudio real
          const audioTracks = remoteStream.getAudioTracks();
          if (audioTracks.length === 0) {
            console.warn('[RECEIVER] Stream recebido sem tracks de áudio!');
            alert('O stream recebido não contém áudio. Verifique se o transmissor iniciou a captura.');
            return;
          }

          // Conecta diretamente ao elemento de áudio
          this.audioElement.srcObject = remoteStream;
          
          try {
            await this.audioElement.play();
            console.log('[RECEIVER] Áudio iniciado com sucesso');
          } catch (e) {
            console.error('[RECEIVER] Erro ao iniciar áudio:', e);
            alert('Erro ao reproduzir áudio. Verifique as permissões do navegador.');
            return;
          }

          // Conecta ao visualizador apenas (sem afetar o áudio)
          try {
            if (audioTracks.length > 0) {
              const source = ctx.createMediaStreamSource(remoteStream);
              source.connect(inputNode);
              console.log('[RECEIVER] Visualizador conectado');
            }
          } catch (err) {
            console.warn('[RECEIVER] Erro no visualizador:', err);
          }

          // Atualiza UI
          this.rxStartBox.classList.add('hidden');
          this.rxActiveDashboard.classList.remove('hidden');
          this.rxActiveDashboard.classList.add('flex');

          this.pwaManager.requestWakeLock();
          this.pwaManager.setupMediaSession();

          // Inicia visualizador
          this.visualizer = new AudioVisualizer(this.rxVisualizerCanvas, analyser);
          this.visualizer.start();

          // Monitor de latência
          this.startLatencyMonitor();
        },
        (msg) => {
          console.log('[Receiver] Mensagem recebida:', msg);
          if (msg.type === 'HOST_STATUS') {
            if (this.rxStatusMessage) {
              if (msg.isTransmitting) {
                this.rxStatusMessage.textContent = '● Recebendo Áudio do PC!';
                this.rxStatusMessage.className = 'text-sm font-bold text-green-neon flex items-center gap-1.5';
              } else {
                this.rxStatusMessage.textContent = '⏳ Conectado! Aguardando transmissão...';
                this.rxStatusMessage.className = 'text-sm font-bold text-amber-300 flex items-center gap-1.5';
              }
            }
          }
        },
        () => {
          console.log('[Receiver] Conexão encerrada');
          this.stopListening();
        }
      );

      this.activeCall = call;
      this.dataConn = dataConn;
      console.log('[Receiver] Conexão estabelecida com sucesso');

    } catch (err) {
      console.error('[Receiver] Erro na conexão:', err);
      alert("Não foi possível conectar à sala " + targetRoom + ".\n\nVerifique se o computador está com o ConectaFone aberto na mesma sala.");
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
