# 🎨 Guia de Aprendizado: `src/ui/` (Interface do Usuário)

Esta pasta gerencia as interações do usuário, manipulação de eventos do DOM e renderização de elementos interativos (como QR Codes e sliders).

---

## 📂 Arquivos e Responsabilidades

### 1. [`transmitter.js`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/src/ui/transmitter.js) • Painel do PC (Host)
- Gera o código único da sala (ex: `CF-7482`).
- Aciona a renderização do QR Code com o link completo da sala.
- Vincula o botão de captura do som do YouTube ao `ScreenAudioCapture` e atualiza a faixa de áudio dos celulares conectados em tempo real.
- Exibe o contador de celulares conectados.

---

### 2. [`receiver.js`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/src/ui/receiver.js) • Painel do Celular (Receiver)
- Lê o código da sala a partir do campo de texto ou do parâmetro da URL (`?room=...`).
- Inicia o contexto de áudio com permissão do usuário (necessário por restrições de autoplay dos navegadores mobile).
- Vincula os sliders de **Volume (+200%)** e **Sincronia de Vídeo (Delay em ms)** aos nós da Web Audio API.
- Liga o visualizador gráfico em Canvas quando a transmissão se inicia.

---

### 3. [`share.js`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/src/ui/share.js) • Compartilhamento
- Utiliza a biblioteca `qrcode` para desenhar o QR Code diretamente em um `<canvas>` HTML5 sem depender de APIs de terceiros.
- Implementa cópia para a área de transferência (`navigator.clipboard.writeText`) com feedback visual ("✓ Copiado!").
- Cria link dinâmico de compartilhamento para WhatsApp com mensagem pré-formatada.
