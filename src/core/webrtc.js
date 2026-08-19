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
 * Aplica parâmetros de alta fidelidade no SDP (Opus HD Stereo + In-band FEC + 128kbps)
 */
function enhanceOpusSDP(sdp) {
  if (!sdp) return sdp;
  return sdp.replace(/a=fmtp:111 ((?:(?!minptime=).)*)\r\n/g, (match, params) => {
    return `a=fmtp:111 ${params};stereo=1;sprop-stereo=1;maxaveragebitrate=128000;useinbandfec=1;cbr=1\r\n`;
  });
}

export class WebRTCManager {
  constructor() {
    this.peer = null;
    this.activeCalls = [];
    this.activeDataConns = [];
    this.currentStream = null;
    this.isTransmittingAudio = false;
    this.roomCode = '';
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
      console.log('[WebRTC Host] Nova chamada recebida. Configurando Opus HD e enviando áudio...');
      call.answer(this.currentStream, {
        sdpTransform: enhanceOpusSDP
      });
      this.activeCalls.push(call);
      if (onPeerCountChange) onPeerCountChange(this.activeCalls.length);

      call.on('close', () => {
        this.activeCalls = this.activeCalls.filter(c => c !== call);
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
    console.log('[WebRTC] Atualizando stream:', isSystemAudio ? 'ÁUDIO REAL' : 'STREAM SILENCIOSO');
    this.currentStream = newStream;
    this.isTransmittingAudio = isSystemAudio;
    const newTrack = newStream ? newStream.getAudioTracks()[0] : null;

    if (newTrack) {
      console.log('[WebRTC] Nova track de áudio:', newTrack.label, newTrack.enabled, newTrack.readyState);
      
      this.activeCalls.forEach((call, index) => {
        try {
          const pc = call.peerConnection;
          if (!pc) {
            console.warn(`[WebRTC] Chamada ${index} sem peerConnection`);
            return;
          }

          const senders = pc.getSenders();
          const audioSender = senders.find(s => s.track && s.track.kind === 'audio');

          if (audioSender) {
            console.log(`[WebRTC] Substituindo track na chamada ${index}...`);
            // Substituição atômica sem necessidade de nova negociação SDP
            audioSender.replaceTrack(newTrack).then(() => {
              console.log(`[WebRTC] Track substituída com sucesso na chamada ${index}`);
            }).catch(err => {
              console.error(`[WebRTC] Erro ao substituir track na chamada ${index}:`, err);
            });
          } else {
            console.log(`[WebRTC] Nenhum audio sender encontrado na chamada ${index}, adicionando nova track...`);
            pc.addTrack(newTrack, newStream);
          }
        } catch (e) {
          console.error('[WebRTC Track Replace Error]:', e);
        }
      });
      
      if (this.activeCalls.length === 0) {
        console.log('[WebRTC] Nenhuma chamada ativa para atualizar stream');
      }
    } else {
      console.warn('[WebRTC] Nenhuma track de áudio encontrada no novo stream');
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
        const call = rxPeer.call(targetPeerId, callStream, {
          sdpTransform: enhanceOpusSDP
        });

        call.on('stream', (remoteStream) => {
          console.log('[Receiver] Stream Opus HD conectado com sucesso!');
          if (onStreamReceived) onStreamReceived(remoteStream);
          resolve({ call, dataConn });
        });

        call.on('close', () => {
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
