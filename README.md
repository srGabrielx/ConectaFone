# 🎧 ConectaFone PRO • WebRTC Audio Streamer (P2P & PWA)

> Transmita e receba áudio em tempo real entre quaisquer dispositivos (**PC, Celular, Tablet, Notebook**) via **WebRTC Peer-to-Peer** (ultra-baixa latência ~30ms, zero custos de servidor, Opus HD Stereo e Auto-Sync).

---

## ☕ Apoie o Projeto via PIX

Se o **ConectaFone PRO** foi útil para você, considere apoiar o desenvolvimento contínuo do projeto com qualquer valor!

- **Chave PIX (E-mail):** `gabriel094x@gmail.com`

---

## 📁 Estrutura do Projeto

```
Conectafone/
├── public/                      # Arquivos estáticos do PWA
│   ├── manifest.json            # Manifesto PWA (Instalação no Celular/Desktop)
│   ├── sw.js                    # Service Worker com Network-First e cache limpo
│   └── icons/                   # Ícones de alta resolução (192x192, 512x512)
│
├── src/                         # Código-fonte Modular (Vite & Tailwind CSS)
│   ├── core/                    # Motores Lógicos
│   │   ├── webrtc.js            # WebRTC P2P + STUN/TURN Relay + Opus HD FEC
│   │   ├── audio.js             # Web Audio API (Master Gain +200%, Lip-Sync Delay)
│   │   ├── capture.js           # Captura de Áudio do Sistema (getDisplayMedia / Mic)
│   │   ├── pwa.js               # Instalação PWA, WakeLock e MediaSession
│   │   └── visualizer.js        # Espectro de frequências 60fps em Canvas
│   ├── ui/                      # Camada de Interface Genérica Multi-Dispositivo
│   │   ├── transmitter.js       # Controle do Transmissor (Host)
│   │   ├── receiver.js          # Controle do Receptor (Client com Auto-Sync)
│   │   └── share.js             # Compartilhamento no WhatsApp, Link e QR Code
│   ├── index.css                # Tailwind CSS v4 e Design System Neon
│   └── main.js                  # Ponto de entrada do app
│
├── index.html                   # HTML Principal
├── vite.config.js               # Configuração do Vite e Tailwind CSS
├── package.json                 # Dependências e scripts
└── vercel.json                  # Configuração para deploy na Vercel
```

---

## 🚀 Como Rodar Localmente

### 1. Instalar Dependências
```bash
npm install
```

### 2. Iniciar Servidor de Desenvolvimento Vite
```bash
npm run dev
```

### 3. Compilar para Produção
```bash
npm run build
```

---

## 🌐 Publicar na Vercel (Gratuito)

O projeto já está configurado para deploy automático na Vercel:
1. Conecte seu repositório GitHub na [Vercel](https://vercel.com).
2. O framework **Vite** será detectado automaticamente (`npm run build` -> pasta `dist/`).
3. Clique em **Deploy**!
