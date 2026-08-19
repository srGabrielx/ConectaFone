/**
 * ConectaFone - Transmitter UI Controller (PC)
 */

import { ShareManager } from './share.js';
import { AudioVisualizer } from '../core/visualizer.js';

export class TransmitterUI {
  constructor(audioEngine, screenCapture, webrtcManager) {
    this.audioEngine = audioEngine;
    this.screenCapture = screenCapture;
    this.webrtcManager = webrtcManager;

    this.roomCodeText = document.getElementById('roomCodeText');
    this.shareLinkInput = document.getElementById('shareLinkInput');
    this.copyShareBtn = document.getElementById('copyShareBtn');
    this.whatsappShareBtn = document.getElementById('whatsappShareBtn');
    this.qrContainer = document.getElementById('qrContainer');
    this.connectedPeersBadge = document.getElementById('connectedPeersBadge');

    this.startSystemAudioBtn = document.getElementById('startSystemAudioBtn');
    this.startDeviceAudioBtn = document.getElementById('startDeviceAudioBtn');
    this.stopCaptureBtn = document.getElementById('stopCaptureBtn');
    this.hostCaptureIdle = document.getElementById('hostCaptureIdle');
    this.hostCaptureActive = document.getElementById('hostCaptureActive');
    this.hostCaptureStatusText = document.getElementById('hostCaptureStatusText');
    this.hostVisualizerCanvas = document.getElementById('hostVisualizerCanvas');

    this.visualizer = null;
  }

  async init() {
    ShareManager.setupShareButtons(this.copyShareBtn, this.whatsappShareBtn, this.shareLinkInput);

    const roomCode = this.webrtcManager.generateRoomCode();
    this.roomCodeText.textContent = roomCode;

    // Se estiver em localhost, sugere o IP da rede local para o celular conseguir abrir
    let baseUrl = window.location.origin;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      baseUrl = `http://${window.location.hostname}:${window.location.port || '3000'}`;
    }

    const fullUrl = `${baseUrl}/?room=${roomCode}`;
    this.shareLinkInput.value = fullUrl;

    await ShareManager.renderQRCode(this.qrContainer, fullUrl);

    // Stream de áudio inicial silencioso para handshake WebRTC
    const silentStream = this.audioEngine.createSilentStream();

    await this.webrtcManager.initHost(
      roomCode,
      silentStream,
      (count) => {
        this.connectedPeersBadge.textContent = `${count} celular${count === 1 ? '' : 'es'} conectado${count === 1 ? '' : 's'}`;
      },
      (msg) => {
        console.log('[Host Data Received]:', msg);
      }
    );

    this.setupCaptureEvents();
  }

  setupCaptureEvents() {
    // 1. Transmitir TODO o Som do PC (Sistema / Tela Inteira)
    if (this.startSystemAudioBtn) {
      this.startSystemAudioBtn.addEventListener('click', async () => {
        try {
          console.log('[Transmitter] Iniciando captura de áudio do sistema...');
          const { stream, analyser, isMobileFallback } = await this.screenCapture.startSystemAudioCapture(() => {
            this.handleCaptureStopped();
          });

          console.log('[Transmitter] Stream capturado com sucesso:', stream);
          console.log('[Transmitter] Tracks no stream:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, label: t.label })));
          
          this.webrtcManager.updateHostStream(stream, true);
          this.hostCaptureIdle.style.display = 'none';
          this.hostCaptureActive.style.display = 'block';
          
          this.hostCaptureStatusText.textContent = isMobileFallback
            ? '● Transmitindo Áudio do Microfone/Linha (Dispositivo Móvel)'
            : '● Transmitindo Áudio do Sistema em Tempo Real!';

          if (this.hostVisualizerCanvas && analyser) {
            this.visualizer = new AudioVisualizer(this.hostVisualizerCanvas, analyser);
            this.visualizer.start();
          }
        } catch (err) {
          console.error('[Transmitter] Erro na captura:', err);
          
          if (err.code === 'SURFACE_WITHOUT_AUDIO' || err.message === 'SURFACE_WITHOUT_AUDIO') {
            alert(
              "⚠️ Áudio Não Detectado na Superfície Selecionada!\n\n" +
              "O Windows e os navegadores não suportam captura de áudio direto de 'Janelas Individuais'.\n\n" +
              "👉 Como resolver:\n" +
              "1. Clique novamente em INICIAR.\n" +
              "2. Escolha 'Tela Inteira' ou 'Guia do Chrome'.\n" +
              "3. Certifique-se de MARCAR a caixa 'Compartilhar áudio do sistema'."
            );
          } else if (err.name === 'NotAllowedError') {
            // Usuário cancelou - não mostrar alerta
            console.log('[Transmitter] Usuário cancelou a seleção de tela');
          } else if (err.message && err.message.includes('Could not start audio source')) {
            alert(
              "❌ Erro ao iniciar fonte de áudio\n\n" +
              "Isso geralmente acontece quando:\n" +
              "• O navegador não tem permissão para capturar áudio do sistema\n" +
              "• Você selecionou uma guia/janela que não suporta áudio\n" +
              "• As configurações de áudio do sistema estão bloqueadas\n\n" +
              "👉 Tente estas soluções:\n" +
              "1. Selecione 'Tela Inteira' em vez de uma janela específica\n" +
              "2. Certifique-se de marcar 'Compartilhar áudio do sistema'\n" +
              "3. Use o botão 'TRANSMITIR VIA MICROFONE/LINHA' como alternativa\n" +
              "4. Verifique as permissões do navegador nas configurações do Windows"
            );
          } else {
            alert("Não foi possível iniciar a captura: " + (err.message || err.name));
          }
        }
      });
    }

    // 2. Transmitir via Mixagem Estéreo / Placa de Som
    if (this.startDeviceAudioBtn) {
      this.startDeviceAudioBtn.addEventListener('click', async () => {
        try {
          console.log('[Transmitter] Iniciando captura de áudio de dispositivo...');
          const { stream, analyser } = await this.screenCapture.startDeviceAudioCapture();
          
          console.log('[Transmitter] Stream de dispositivo capturado:', stream);
          console.log('[Transmitter] Tracks no stream:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, label: t.label })));
          
          this.webrtcManager.updateHostStream(stream, true);
          this.hostCaptureIdle.style.display = 'none';
          this.hostCaptureActive.style.display = 'block';
          this.hostCaptureStatusText.textContent = '● Transmitindo via Mixagem Estéreo / Placa de Som!';

          if (this.hostVisualizerCanvas && analyser) {
            this.visualizer = new AudioVisualizer(this.hostVisualizerCanvas, analyser);
            this.visualizer.start();
          }
        } catch (err) {
          console.error('[Transmitter] Erro na captura de dispositivo:', err);
          
          if (err.name === 'NotAllowedError') {
            alert("Permissão de microfone negada. Verifique as configurações do navegador.");
          } else if (err.name === 'NotFoundError') {
            alert("Nenhum dispositivo de áudio encontrado. Verifique se seu microfone/linha está conectado.");
          } else if (err.message && err.message.includes('Could not start audio source')) {
            alert(
              "❌ Erro ao iniciar dispositivo de áudio\n\n" +
              "👉 Soluções:\n" +
              "1. Verifique se o microfone/entrada de linha está conectado\n" +
              "2. Verifique as permissões do navegador\n" +
              "3. Tente usar 'TRANSMITIR TODO O SOM DO PC' como alternativa"
            );
          } else {
            alert("Não foi possível acessar a Mixagem Estéreo. Experimente o botão 'TRANSMITIR TODO O SOM DO PC (TELA INTEIRA)' acima. Erro: " + (err.message || err.name));
          }
        }
      });
    }

    // 3. Parar Transmissão
    if (this.stopCaptureBtn) {
      this.stopCaptureBtn.addEventListener('click', () => {
        this.screenCapture.stopCapture();
        this.handleCaptureStopped();
      });
    }
  }

  handleCaptureStopped() {
    if (this.visualizer) {
      this.visualizer.stop();
      this.visualizer = null;
    }
    const silentStream = this.audioEngine.createSilentStream();
    this.webrtcManager.updateHostStream(silentStream, false);
    this.hostCaptureActive.style.display = 'none';
    this.hostCaptureIdle.style.display = 'block';
  }
}
