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
    this.hostVideoPreview = document.getElementById('hostVideoPreview');

    this.visualizer = null;
  }

  async init() {
    ShareManager.setupShareButtons(this.copyShareBtn, this.whatsappShareBtn, this.shareLinkInput);

    const roomCode = this.webrtcManager.generateRoomCode();
    this.roomCodeText.textContent = roomCode;

    // Utiliza a origem atual (ex: Cloudflare Tunnel https://...trycloudflare.com ou IP/Domínio)
    const baseUrl = window.location.origin;
    const fullUrl = `${baseUrl}/?room=${roomCode}`;
    this.shareLinkInput.value = fullUrl;

    await ShareManager.renderQRCode(this.qrContainer, fullUrl);

    // Inicializa o host sem stream inicial - vai esperar o usuário iniciar captura
    await this.webrtcManager.initHost(
      roomCode,
      null, // Sem stream inicial - vai ser adicionado quando usuário iniciar captura
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
          const { stream, videoStream, analyser, captureSurface, isMobileFallback } = await this.screenCapture.startSystemAudioCapture(() => {
            this.handleCaptureStopped();
          });

          console.log('[Transmitter] Stream capturado com sucesso:', stream);
          console.log('[Transmitter] Surface capturada:', captureSurface);
          
          this.webrtcManager.updateHostStream(stream, true);
          this.hostCaptureIdle.style.display = 'none';
          this.hostCaptureActive.style.display = 'block';
          
          const surfaceName = captureSurface === 'monitor' ? 'Tela Inteira' : (captureSurface === 'window' ? 'Janela' : (captureSurface === 'browser' ? 'Guia' : 'Sistema'));
          this.hostCaptureStatusText.textContent = isMobileFallback
            ? '● Transmitindo Áudio do Microfone/Linha (Dispositivo Móvel)'
            : `● Transmitindo Áudio do Sistema (${surfaceName}) em Tempo Real!`;

          if (this.hostVideoPreview && videoStream) {
            this.hostVideoPreview.srcObject = videoStream;
            this.hostVideoPreview.style.display = 'block';
          }

          if (this.hostVisualizerCanvas && analyser) {
            this.visualizer = new AudioVisualizer(this.hostVisualizerCanvas, analyser);
            this.visualizer.start();
          }
        } catch (err) {
          console.error('[Transmitter] Erro na captura:', err);
          
          if (err.code === 'MOBILE_AUDIO_UNSUPPORTED') {
            alert(err.message);
          } else if (err.code === 'SYSTEM_AUDIO_NOT_SHARED' || err.code === 'SURFACE_WITHOUT_AUDIO' || err.message === 'SYSTEM_AUDIO_NOT_SHARED') {
            alert(
              "Áudio do sistema não foi compartilhado.\n\n" +
              "1. Abra a aba Tela inteira\n" +
              "2. Selecione seu monitor\n" +
              "3. Ative Compartilhar áudio do sistema\n" +
              "4. Clique em Compartilhar"
            );
          } else if (err.name === 'NotAllowedError') {
            // Usuário cancelou - não mostrar alerta
            console.log('[Transmitter] Usuário cancelou a seleção de tela');
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
          
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            alert("⚠️ Permissão Necessária!\n\nO navegador precisa de permissão de Áudio/Microfone para transmitir.\n\n👉 Clique no ícone de cadeado/configurações ao lado do link na barra de endereços do navegador e marque 'Permitir Microfone/Áudio'.");
          } else if (err.name === 'NotFoundError' || err.message === 'NO_AUDIO_DEVICE_FOUND') {
            alert("Nenhum dispositivo de áudio/microfone encontrado. Verifique se seu microfone ou mixagem estéreo está conectado e habilitado.");
          } else {
            alert("Não foi possível acessar o áudio do dispositivo. Tente usar o botão 'TRANSMITIR TODO O SOM DO PC (TELA INTEIRA)' acima. Detalhes: " + (err.message || err.name));
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
    if (this.hostVideoPreview) {
      this.hostVideoPreview.srcObject = null;
      this.hostVideoPreview.style.display = 'none';
    }
    // Quando a captura para, para de transmitir completamente (não substitui por stream silencioso)
    this.webrtcManager.updateHostStream(null, false);
    this.hostCaptureActive.style.display = 'none';
    this.hostCaptureIdle.style.display = 'block';
  }
}
