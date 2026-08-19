# 📦 Guia de Aprendizado: `public/` (Ativos Estáticos & PWA)

Arquivos colocados nesta pasta são servidos diretamente pelo Vite na raiz do site (`/`) sem passar pelo processo de compilação ou minificação.

---

## 📂 Conteúdo e Função

### 1. [`manifest.json`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/public/manifest.json) • Manifesto da Aplicação Web
- Permite que navegadores mobile (Chrome, Safari, Edge) reconheçam o site como um **Progressive Web App (PWA)**.
- Define o nome do app (`ConectaFone Pro`), cores de tema (`#00f2fe`), modo de exibição (`standalone` para remover a barra do navegador) e ícones.

### 2. [`sw.js`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/public/sw.js) • Service Worker
- Roda em segundo plano no navegador independentemente da página web.
- Realiza o cache dos ativos essenciais para carregamento instantâneo.
- Ignora chamadas dinâmicas de sinalização WebRTC para não interferir na transmissão do áudio.

### 3. `icons/` • Ícones de Alta Resolução
- `icon-192.png`: Usado para telas iniciais de smartphones.
- `icon-512.png`: Usado para splash screens e telas de alta densidade de pixels (Retina/OLED).
