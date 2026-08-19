# ⚡ Guia de Aprendizado: `src/core/` (Motores Lógicos)

Esta pasta contém o "coração" do ConectaFone: toda a inteligência de áudio em tempo real, rede P2P e recursos nativos de navegador.

---

## 📚 Arquivos e Conceitos Envolvidos

### 1. [`audio.js`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/src/core/audio.js) • Web Audio API
- **O que faz**: Cria o grafo de nós de áudio no navegador (`AudioContext`).
- **Nós Utilizados**:
  - `GainNode`: Controla o volume e permite amplificação (+200%) para filmes baixos.
  - `DelayNode`: Aplica atraso configurável em milissegundos para sincronizar perfeitamente o áudio com o movimento dos lábios nos vídeos (**Lip-Sync**).
  - `AnalyserNode`: Extrai dados de amplitude e frequências usando FFT (Fast Fourier Transform) para alimentar o visualizador gráfico.
  - `OscillatorNode`: Gera ondas senoidais para modo de teste sintético.

---

### 2. [`webrtc.js`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/src/core/webrtc.js) • WebRTC & PeerJS
- **O que faz**: Estabelece conexão direta de dados e mídia entre o Computador (Host) e o Celular (Receiver) via protocolo **WebRTC**.
- **Por que é rápido**: Não passa o áudio por um servidor intermediário (P2P). A latência fica entre **20ms e 60ms**.
- **Servidores STUN**: Usados apenas para descobrir o IP público dos dispositivos e permitir que eles conversem entre si mesmo atrás de roteadores (NAT).

---

### 3. [`capture.js`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/src/core/capture.js) • Screen & Tab Capture API
- **O que faz**: Utiliza a API `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`.
- **Como funciona**: Captura o áudio emitido por uma guia do Chrome (como o YouTube) ou da tela inteira do Windows e transforma em uma `MediaStream` para transmissão.

---

### 4. [`pwa.js`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/src/core/pwa.js) • Recursos Nativos de Celular
- **Service Worker**: Registra o arquivo `sw.js` para permitir cache offline.
- **`beforeinstallprompt`**: Captura o evento nativo para exibir o botão customizado "📲 Baixar App".
- **Screen Wake Lock API**: Evita que a tela do celular apague enquanto você estiver ouvindo áudio.
- **Media Session API**: Cria o controle multimídia na tela de bloqueio e na barra de notificações do celular.

---

### 5. [`visualizer.js`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/src/core/visualizer.js) • Gráficos em Canvas 60 FPS
- **O que faz**: Usa a API `requestAnimationFrame` e a matriz de bytes do `AnalyserNode` para desenhar barras de espectro de áudio com gradiente neon no elemento `<canvas>`.
