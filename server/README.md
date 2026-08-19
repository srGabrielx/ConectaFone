# 🐍 Guia de Aprendizado: `server/` (Backend Python Opcional)

Esta pasta contém o servidor local em Python criado para capturar o áudio diretamente do driver de som do Windows (WASAPI / Mixagem Estéreo) e transmiti-lo via WebSockets binários em rede local.

---

## 📂 Arquivos e Tecnologias

| Arquivo | Tecnologia | Finalidade |
| :--- | :--- | :--- |
| [`server.py`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/server/server.py) | **FastAPI & Uvicorn** | Servidor HTTP assíncrono e WebSocket que aceita conexões simultâneas de múltiplos celulares. |
| [`audio_engine.py`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/server/audio_engine.py) | **SoundDevice & NumPy** | Captura os buffers de áudio PCM da placa de som em 44.1kHz / 16-bit e faz o empacotamento binário. |
| [`loopback_capture.cs`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/server/loopback_capture.cs) | **C# / WASAPI** | Utilitário complementar para captura de som de alto-falantes em modo Loopback no Windows. |
| [`requirements.txt`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/server/requirements.txt) | **Pip** | Lista de dependências Python necessárias para rodar o backend. |
| [`start.bat`](file:///d:/Cursos/Web-SItes/Premium-HTML/Conectafone/server/start.bat) | **Windows Batch Script** | Script de inicialização automática em 1 clique. |

---

## 💡 Quando usar este Backend em vez do WebRTC da Web?

- **Use a Web (Vite / Vercel)**: Quando quiser facilidade máxima, sem precisar instalar Python ou configurar portas de rede local, transmitindo o som de guias do navegador (como YouTube) ou da tela via WebRTC P2P.
- **Use o Servidor Python**: Quando precisar capturar jogos pesados ou softwares específicos do Windows que não passem pelo navegador, usando a placa de som diretamente em modo loopback.
