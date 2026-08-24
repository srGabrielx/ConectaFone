/**
 * ConectaFone PRO - Enterprise WebRTC Audio Mesh & TURN Engine
 * Opus HD Stereo, Forward Error Correction (FEC), 128kbps Bitrate e Reconexão Automática
 */

import { Peer } from 'peerjs';

const ICE_SERVERS = [
  // STUN Servers Globais (Google, Cloudflare, Twilio)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' },

  // TURN Relay Servers (Garante conectividade através de CGNAT, 4G/5G e Firewalls corporativos)
  {
    urls: [
      'stun:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp'
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

/**
 * Aplica parâmetros de alta fidelidade no SDP (Opus HD Stereo VBR + In-band FEC + 256kbps)
 */
function enhanceOpusSDP(sdp) {
  if (!sdp) return sdp;

  // Encontra dinamicamente o payload type do Opus (geralmente 111, mas pode variar)
  const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
  const pt = opusMatch ? opusMatch[1] : '111';

  const fmtpRegex = new RegExp(`a=fmtp:${pt} (.*)\\r\\n`, 'g');

  if (fmtpRegex.test(sdp)) {
    return sdp.replace(new RegExp(`a=fmtp:${pt} (.*)\\r\\n`, 'g'), (match, params) => {
      // Remove parâmetros existentes para evitar duplicação
      const cleanParams = params
        .replace(/stereo=\d;?/g, '')
        .replace(/sprop-stereo=\d;?/g, '')
        .replace(/maxaveragebitrate=\d+;?/g, '')
        .replace(/useinbandfec=\d;?/g, '')
        .replace(/cbr=\d;?/g, '')
        .trim();
      return `a=fmtp:${pt} ${cleanParams ? cleanParams + ';' : ''}stereo=1;sprop-stereo=1;maxaveragebitrate=256000;useinbandfec=1\r\n`;
    });
  } else {
    // Se não existir linha fmtp para o Opus, adiciona logo após a linha rtpmap
    return sdp.replace(
      new RegExp(`(a=rtpmap:${pt} opus\\/48000\\/2\\r\\n)`, 'i'),
      `$1a=fmtp:${pt} minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=256000\r\n`
    );
  }
}

export class WebRTCManager {
  constructor() {
    this.peer = null;
    this.activeCalls = [];
    this.activeDataConns = [];
    this.currentStream = null;
    this.isTransmittingAudio = false;
    this.roomCode = '';
    this.audioTransceivers = new Map(); // Mapa para armazenar transceivers de áudio por chamada
  }

  generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'CF-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.roomCode = code;
    return code;
  }

  createSilentStream() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass({
        sampleRate: 48000
      });
      const destination = ctx.createMediaStreamDestination();
      destination.channelCount = 2;
      destination.channelCountMode = 'explicit';
      destination.channelInterpretation = 'speakers';

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0; // Áudio 100% silencioso em estéreo
      oscillator.connect(gainNode);
      gainNode.connect(destination);
      oscillator.start();

      return destination.stream;
    } catch (e) {
      console.warn('[WebRTC Host] Falha ao criar silent stream estéreo:', e);
      return null;
    }
  }

  initHost(roomCode, initialStream, onPeerCountChange, onClientMessage) {
    this.roomCode = roomCode;
    this.currentStream = initialStream;
    const hostPeerId = 'cfone_' + roomCode.replace('-', '').toLowerCase();

    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
    }

    this.peer = new Peer(hostPeerId, {
      debug: 1,
      config: {
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10
      }
    });

    // Conexões de Dados (Handshake e Status)
    this.peer.on('connection', (dataConn) => {
      this.activeDataConns.push(dataConn);

      dataConn.on('open', () => {
        dataConn.send({
          type: 'HOST_STATUS',
          isTransmitting: this.isTransmittingAudio,
          roomCode: this.roomCode
        });
      });

      dataConn.on('data', (data) => {
        if (onClientMessage) onClientMessage(data, dataConn);
      });

      dataConn.on('close', () => {
        this.activeDataConns = this.activeDataConns.filter(c => c !== dataConn);
      });
    });

    // Chamadas de Áudio WebRTC
    this.peer.on('call', (call) => {
      console.log('[WebRTC Host] Nova chamada recebida. Configurando stream e Opus HD...');
      
      // Garante que SEMPRE haverá um stream para responder (mesmo silencioso)
      // Isso resolve o bug onde o ouvinte não consegue entrar na sala se o host não estiver transmitindo.
      let answerStream = this.currentStream || this.createSilentStream();

      // Responde a chamada com o stream atual ou o silencioso
      call.answer(answerStream, {
        sdpTransform: enhanceOpusSDP
      });
      this.activeCalls.push(call);
      if (onPeerCountChange) onPeerCountChange(this.activeCalls.length);

      call.on('close', () => {
        this.activeCalls = this.activeCalls.filter(c => c !== call);
        this.audioTransceivers.delete(call);
        if (onPeerCountChange) onPeerCountChange(this.activeCalls.length);
      });
    });

    return new Promise((resolve, reject) => {
      this.peer.on('open', (id) => resolve(id));
      this.peer.on('error', (err) => {
        console.warn('[WebRTC Host Error]:', err);
        if (err.type === 'unavailable-id') {
          const newCode = this.generateRoomCode();
          this.initHost(newCode, this.currentStream, onPeerCountChange, onClientMessage)
            .then(resolve)
            .catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  broadcastStatus(isTransmitting) {
    this.isTransmittingAudio = isTransmitting;
    const msg = {
      type: 'HOST_STATUS',
      isTransmitting: isTransmitting,
      roomCode: this.roomCode
    };

    this.activeDataConns.forEach(conn => {
      try {
        if (conn.open) conn.send(msg);
      } catch (e) {}
    });
  }

  updateHostStream(newStream, isSystemAudio = false) {
    console.log('[WEBRTC] updateHostStream chamado:', isSystemAudio ? 'ÁUDIO REAL' : 'SEM ÁUDIO');
    this.currentStream = newStream;
    this.isTransmittingAudio = isSystemAudio;
    
    // Se newStream for nulo (captura parada), usa uma track silenciosa para manter a conexão WebRTC ativa
    const targetTrack = newStream ? newStream.getAudioTracks()[0] : (this.createSilentStream()?.getAudioTracks()[0] || null);

    this.activeCalls.forEach((call, index) => {
      try {
        const pc = call.peerConnection;
        if (!pc) {
          console.warn(`[WEBRTC] Chamada ${index} sem peerConnection`);
          return;
        }

        // Localiza o RTCRtpSender de áudio da chamada
        let audioSender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
        
        // Se a track anterior era nula, busca pelo transceiver de áudio
        if (!audioSender) {
           const transceivers = pc.getTransceivers();
           const audioTransceiver = transceivers.find(t => 
             t.receiver?.track?.kind === 'audio' || 
             t.sender?.track?.kind === 'audio' || 
             t.mid !== null
           );
           if (audioTransceiver) {
              audioSender = audioTransceiver.sender;
           } else if (pc.getSenders().length > 0) {
              audioSender = pc.getSenders()[0];
           }
        }

        if (audioSender && targetTrack) {
          console.log(`[WEBRTC] Chamada ${index} - Substituindo audio track no RTCRtpSender...`);
          audioSender.replaceTrack(targetTrack).then(async () => {
            console.log(`[WEBRTC] Track substituída com sucesso na chamada ${index}`);

            // Aplica bitrate máximo diretamente nos parâmetros do RTCRtpSender
            try {
              const params = audioSender.getParameters();
              if (!params.encodings || !params.encodings.length) {
                params.encodings = [{}];
              }
              params.encodings[0].maxBitrate = 256000;
              await audioSender.setParameters(params);
            } catch (pErr) {
              console.warn('[WEBRTC] sender.setParameters notice:', pErr);
            }

            console.log('[WEBRTC AUDIO SENDER]', {
              kind: audioSender.track?.kind ?? null,
              label: audioSender.track?.label ?? null,
              enabled: audioSender.track?.enabled ?? null,
              muted: audioSender.track?.muted ?? null,
              readyState: audioSender.track?.readyState ?? null
            });
          }).catch(err => {
            console.error(`[WEBRTC] Erro ao substituir track na chamada ${index}:`, err);
          });
        } else if (targetTrack && pc.addTrack) {
          console.log(`[WEBRTC] Chamada ${index} - Nenhum sender encontrado, adicionando track diretamente...`);
          try {
            pc.addTrack(targetTrack, newStream || this.createSilentStream());
          } catch (e) {
            console.warn('[WEBRTC] addTrack falhou:', e);
          }
        }
      } catch (e) {
        console.error('[WEBRTC Track Replace Error]:', e);
      }
    });
    
    if (this.activeCalls.length === 0) {
      console.log('[WEBRTC] Nenhuma chamada ativa para atualizar stream');
    }

    this.broadcastStatus(isSystemAudio);
  }

  connectReceiver(roomCode, callStream, onStreamReceived, onStatusMessage, onClosed) {
    const targetPeerId = 'cfone_' + roomCode.replace('-', '').toLowerCase();
    const rxPeerId = 'cfrx_' + Math.floor(Math.random() * 899999 + 100000);

    const rxPeer = new Peer(rxPeerId, {
      debug: 1,
      config: {
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10
      }
    });

    return new Promise((resolve, reject) => {
      rxPeer.on('open', () => {
        console.log('[Receiver] Conectando ao host via WebRTC + TURN Relay:', targetPeerId);

        // 1. Data Connection
        const dataConn = rxPeer.connect(targetPeerId, { reliable: true });
        dataConn.on('data', (data) => {
          if (onStatusMessage) onStatusMessage(data);
        });

        // 2. Audio Call com SDP Munging
        // Se callStream for null, passamos um silent stream para forçar a negociação de m=audio
        const streamToUse = callStream || this.createSilentStream();
        const call = rxPeer.call(targetPeerId, streamToUse, {
          sdpTransform: enhanceOpusSDP
        });

        call.on('stream', (remoteStream) => {
          console.log('[Receiver] Stream Opus HD conectado com sucesso!');
          if (onStreamReceived) onStreamReceived(remoteStream);
          resolve({ call, dataConn });
        });

        call.on('close', () => {
          console.log('[Receiver] Chamada fechada pelo host');
          if (onClosed) onClosed();
        });

        call.on('error', (err) => {
          reject(err);
        });
      });

      rxPeer.on('error', (err) => {
        reject(err);
      });
    });
  }
}
