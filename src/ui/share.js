/**
 * ConectaFone - Share & QR Code Manager
 */

import QRCode from 'qrcode';

export class ShareManager {
  static async renderQRCode(container, text) {
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, text, {
      width: 140,
      margin: 1,
      color: {
        dark: '#00f2fe',
        light: '#0b0f19'
      }
    });
    container.appendChild(canvas);
  }

  static setupShareButtons(copyBtn, whatsappBtn, linkInput) {
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(linkInput.value);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ Copiado!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      });
    }

    if (whatsappBtn) {
      whatsappBtn.addEventListener('click', () => {
        const msg = encodeURIComponent(`🎧 Conecte-se ao áudio do meu computador no ConectaFone: ${linkInput.value}`);
        window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
      });
    }
  }
}
