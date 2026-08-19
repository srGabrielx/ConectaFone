"""
ConectaFone - Audio Engine
Módulo de captura, geração de teste, processamento e distribuição de áudio em tempo real.
"""

import asyncio
import io
import math
import struct
import threading
import time
from typing import Dict, List, Optional, Set

import numpy as np
import sounddevice as sd


class AudioEngine:
    def __init__(self, sample_rate: int = 44100, channels: int = 2, block_size: int = 1024):
        self.sample_rate = sample_rate
        self.channels = channels
        self.block_size = block_size  # ~23.2ms per block at 44.1kHz

        self.mode = "test_tone"  # "device", "browser_stream", "test_tone"
        self.selected_device: Optional[int] = None
        self.gain: float = 1.0
        self.is_running = False

        self._stream: Optional[sd.InputStream] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._subscribers: Set[asyncio.Queue] = set()
        self._subscribers_lock = threading.Lock()

        # Metrics for dashboard
        self.current_rms: float = 0.0
        self.current_peak: float = 0.0
        self.total_frames_streamed: int = 0
        self.last_audio_time: float = time.time()

        # Test tone synthesis state
        self._tone_phase: float = 0.0
        self._test_beat_counter: int = 0
        self._test_tone_thread: Optional[threading.Thread] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    def get_devices(self) -> List[Dict]:
        """Lista todos os dispositivos de áudio disponíveis no sistema."""
        devices = []
        try:
            device_list = sd.query_devices()
            default_input = sd.default.device[0] if sd.default.device else 0

            for idx, dev in enumerate(device_list):
                devices.append({
                    "id": idx,
                    "name": dev["name"],
                    "hostapi": dev.get("hostapi", 0),
                    "max_inputs": dev["max_input_channels"],
                    "max_outputs": dev["max_output_channels"],
                    "default_samplerate": int(dev.get("default_samplerate", 44100)),
                    "is_input": dev["max_input_channels"] > 0,
                    "is_output": dev["max_output_channels"] > 0,
                    "is_default": idx == default_input
                })
        except Exception as e:
            print(f"[AudioEngine] Erro ao listar dispositivos: {e}")
        return devices

    def start(self):
        """Inicia o motor de áudio."""
        if self.is_running:
            return
        self.is_running = True

        # Tenta selecionar dispositivo padrão de entrada se disponível
        devices = self.get_devices()
        input_devs = [d for d in devices if d["is_input"]]
        if input_devs and self.selected_device is None:
            self.selected_device = input_devs[0]["id"]

        self._apply_mode()
        print(f"[AudioEngine] Motor de áudio iniciado. Modo: {self.mode}")

    def stop(self):
        """Para o motor de áudio."""
        self.is_running = False
        self._stop_device_stream()

    def set_mode(self, mode: str, device_id: Optional[int] = None):
        """Alterna entre modos: 'device', 'browser_stream', 'test_tone'."""
        self.mode = mode
        if device_id is not None:
            self.selected_device = device_id
        self._apply_mode()

    def set_gain(self, gain: float):
        """Define o ganho de áudio (1.0 = 100%, 2.0 = 200%)."""
        self.gain = max(0.0, min(5.0, gain))

    def _apply_mode(self):
        """Aplica o modo de áudio selecionado."""
        self._stop_device_stream()

        if self.mode == "device":
            self._start_device_stream()
        elif self.mode == "test_tone":
            self._start_test_tone()
        elif self.mode == "browser_stream":
            print("[AudioEngine] Modo Cinema/Upload pronto para receber áudio do navegador.")

    def _stop_device_stream(self):
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None

    def _start_device_stream(self):
        try:
            target_device = self.selected_device
            print(f"[AudioEngine] Iniciando captura do dispositivo ID {target_device}...")

            # Verifica número de canais suportados
            dev_info = sd.query_devices(target_device)
            max_in = dev_info["max_input_channels"]
            channels = min(self.channels, max_in) if max_in > 0 else 1

            def _callback(indata, frames, time_info, status):
                if status:
                    pass
                # Converte para float32 stereo se necessário
                data = indata.astype(np.float32)
                if channels == 1 and self.channels == 2:
                    # Converte mono para stereo
                    data = np.column_stack((data[:, 0], data[:, 0]))

                self.push_pcm_audio(data)

            self._stream = sd.InputStream(
                device=target_device,
                channels=channels,
                samplerate=self.sample_rate,
                blocksize=self.block_size,
                callback=_callback,
                dtype=np.float32
            )
            self._stream.start()
            print(f"[AudioEngine] Captura iniciada com sucesso em {dev_info['name']}")
        except Exception as e:
            print(f"[AudioEngine] Erro ao iniciar captura de dispositivo: {e}. Alternando para modo teste.")
            self.mode = "test_tone"
            self._start_test_tone()

    def _start_test_tone(self):
        """Inicia gerador de áudio sintetizado em background thread."""
        if self._test_tone_thread and self._test_tone_thread.is_alive():
            return

        def _test_loop():
            # Gera acordes harmônicos e batimentos relaxantes para verificação imediata
            # Acorde suave em A (La) maior com modulação estéreo
            frequencies = [440.0, 554.37, 659.25, 880.0]
            chord_idx = 0
            time_in_chord = 0.0

            while self.is_running and self.mode == "test_tone":
                t = np.arange(self.block_size) / self.sample_rate
                f1 = frequencies[chord_idx % len(frequencies)]
                f2 = frequencies[(chord_idx + 2) % len(frequencies)]

                # Modulação suave
                envelope = 0.5 * (1.0 + np.sin(2.0 * math.pi * 0.5 * (time.time())))

                # Canal esquerdo e direito levemente defasados
                left = 0.25 * envelope * np.sin(2.0 * math.pi * f1 * (self._tone_phase + t))
                right = 0.25 * envelope * np.sin(2.0 * math.pi * f2 * (self._tone_phase + t))

                stereo_chunk = np.column_stack((left, right)).astype(np.float32)
                self.push_pcm_audio(stereo_chunk)

                self._tone_phase += self.block_size / self.sample_rate
                time_in_chord += self.block_size / self.sample_rate
                if time_in_chord >= 2.0:
                    time_in_chord = 0.0
                    chord_idx += 1

                # Dorme exatamente a duração do bloco (~23ms)
                time.sleep(self.block_size / self.sample_rate * 0.95)

        self._test_tone_thread = threading.Thread(target=_test_loop, daemon=True)
        self._test_tone_thread.start()

    def push_pcm_audio(self, audio_data: np.ndarray):
        """
        Recebe um chunk de áudio Float32 numpy [-1.0, 1.0] stereo/mono.
        Aplica ganho, calcula métricas e despacha para os clientes conectados.
        """
        if not self.is_running:
            return

        # Aplica ganho
        if self.gain != 1.0:
            audio_data = np.clip(audio_data * self.gain, -1.0, 1.0)

        # Atualiza métricas VU
        rms = float(np.sqrt(np.mean(audio_data ** 2)))
        peak = float(np.max(np.abs(audio_data)))
        self.current_rms = round(rms, 4)
        self.current_peak = round(peak, 4)
        self.last_audio_time = time.time()
        self.total_frames_streamed += len(audio_data)

        # Converte para Int16 PCM binário para máxima eficiência e compatibilidade
        int16_data = (audio_data * 32767.0).astype(np.int16)
        raw_bytes = int16_data.tobytes()

        # Timestamp em milissegundos para sincronização lip-sync precisa
        timestamp_ms = int(time.time() * 1000)

        # Monta pacote binário:
        # [8 bytes: timestamp_ms uint64] + [4 bytes: sample_rate uint32] + [2 bytes: channels uint16] + [PCM bytes]
        packet_header = struct.pack("!QIH", timestamp_ms, self.sample_rate, self.channels)
        packet = packet_header + raw_bytes

        # Despacha para todos os subscribers assíncronos
        with self._subscribers_lock:
            subs = list(self._subscribers)

        if subs and self._loop and self._loop.is_running():
            for q in subs:
                try:
                    if q.qsize() < 20:  # Evita acúmulo de buffer se um cliente estiver lento
                        self._loop.call_soon_threadsafe(q.put_nowait, packet)
                    else:
                        # Descarta pacote mais antigo para manter ultra-baixa latência
                        try:
                            q.get_nowait()
                        except Exception:
                            pass
                        self._loop.call_soon_threadsafe(q.put_nowait, packet)
                except Exception:
                    pass

    def subscribe(self) -> asyncio.Queue:
        """Inscreve um cliente para receber pacotes de áudio."""
        q = asyncio.Queue(maxsize=30)
        with self._subscribers_lock:
            self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        """Remove inscrição de um cliente."""
        with self._subscribers_lock:
            self._subscribers.discard(q)

    def get_status(self) -> Dict:
        """Retorna status atual do motor."""
        return {
            "is_running": self.is_running,
            "mode": self.mode,
            "selected_device": self.selected_device,
            "sample_rate": self.sample_rate,
            "channels": self.channels,
            "gain": round(self.gain, 2),
            "rms": self.current_rms,
            "peak": self.current_peak,
            "connected_subscribers": len(self._subscribers),
            "total_frames": self.total_frames_streamed
        }


# Instância global do motor de áudio
audio_engine = AudioEngine()
