/**
 * ConectaFone Pro - Application Entrypoint (Vite, Tailwind CSS & Vercel Analytics)
 */

import './index.css';
import { inject } from '@vercel/analytics';

import { AudioEngine } from './core/audio.js';
import { ScreenAudioCapture } from './core/capture.js';
import { WebRTCManager } from './core/webrtc.js';
import { PWAManager } from './core/pwa.js';

import { TransmitterUI } from './ui/transmitter.js';
import { ReceiverUI } from './ui/receiver.js';

// Ativa métricas oficiais do Vercel Analytics
inject();

document.addEventListener('DOMContentLoaded', async () => {
  // Core Services
  const audioEngine = new AudioEngine();
  const screenCapture = new ScreenAudioCapture(audioEngine);
  const webrtcManager = new WebRTCManager();
  const pwaManager = new PWAManager();

  // PWA Setup
  const installBtn = document.getElementById('installPwaBtn');
  pwaManager.init(() => {
    installBtn.style.display = 'inline-flex';
  });

  installBtn.addEventListener('click', async () => {
    const accepted = await pwaManager.promptInstall();
    if (accepted) {
      installBtn.style.display = 'none';
    }
  });

  // PIX Buttons Setup
  const pixKey = 'gabriel094x@gmail.com';
  const pixHeaderBtn = document.getElementById('pixHeaderBtn');
  const copyPixFooterBtn = document.getElementById('copyPixFooterBtn');

  function setupPixCopy(button, defaultText) {
    if (!button) return;
    button.addEventListener('click', () => {
      navigator.clipboard.writeText(pixKey).then(() => {
        button.innerHTML = '✓ PIX Copiado!';
        setTimeout(() => {
          button.innerHTML = defaultText;
        }, 2000);
      }).catch(() => {
        prompt('Chave PIX:', pixKey);
      });
    });
  }

  if (pixHeaderBtn) {
    setupPixCopy(pixHeaderBtn, `
      <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
      <span>Apoiar PIX</span>
    `);
  }

  if (copyPixFooterBtn) {
    setupPixCopy(copyPixFooterBtn, '💚 Copiar Chave PIX: gabriel094x@gmail.com');
  }

  // UI Controllers
  const transmitterUI = new TransmitterUI(audioEngine, screenCapture, webrtcManager);
  const receiverUI = new ReceiverUI(audioEngine, webrtcManager, pwaManager);

  receiverUI.init();

  // View Switcher Setup (Multi-Device Generic)
  const hostBtn = document.getElementById('hostBtn');
  const rxBtn = document.getElementById('rxBtn');
  const hostView = document.getElementById('hostView');
  const rxView = document.getElementById('rxView');

  let hostInitialized = false;

  function switchView(mode) {
    const isHost = mode === 'host';
    hostBtn.classList.toggle('active', isHost);
    rxBtn.classList.toggle('active', !isHost);
    
    // Classes de exibição dinâmica
    if (isHost) {
      hostView.classList.remove('hidden');
      hostView.classList.add('grid');
      rxView.classList.add('hidden');
      rxView.classList.remove('flex');
    } else {
      hostView.classList.add('hidden');
      hostView.classList.remove('grid');
      rxView.classList.remove('hidden');
      rxView.classList.add('flex');
    }

    if (isHost && !hostInitialized) {
      hostInitialized = true;
      transmitterUI.init();
    }
  }

  hostBtn.addEventListener('click', () => switchView('host'));
  rxBtn.addEventListener('click', () => switchView('rx'));

  // Check URL Params (?room=CF-xxxx)
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');

  if (roomParam) {
    receiverUI.setRoomCode(roomParam.toUpperCase());
    switchView('rx');
  } else {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    switchView(isMobile ? 'rx' : 'host');
  }
});
