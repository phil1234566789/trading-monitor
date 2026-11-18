"""Realtime-Weckruf statt Leerlauf-Poll. Nur stdlib: Releases verteilen .py-Module, installieren keine Pakete."""
import base64
import json
import os
import select
import socket
import ssl
import struct
import threading
import time
from urllib.parse import urlparse, urlencode


class WakeListener:
    def __init__(self, url, apikey, topic):
        parsed = urlparse(url)
        if parsed.scheme != 'wss' or not parsed.hostname or not apikey or not topic:
            raise ValueError('invalid_realtime_config')
        self.host, self.path = parsed.hostname, parsed.path + '?' + urlencode(dict(apikey=apikey, vsn='1.0.0'))
        self.topic = 'realtime:' + topic
        self.event = threading.Event()
        self.joined = False
        self.ref = 0

    def start(self):
        threading.Thread(target=self.run, name='mmt-wake', daemon=True).start()
        return self

    def run(self):
        backoff = 1
        while True:
            try:
                self.session()
                backoff = 1
            except Exception as error:
                print(json.dumps(dict(event='wake_listener_reconnect', error=type(error).__name__)), flush=True)
            # Verpasste Weckrufe während der Lücke: ein Zyklus nach jeder Trennung ist billiger als ein verschlafener Entry.
            self.joined = False
            self.event.set()
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)

    def session(self):
        raw = socket.create_connection((self.host, 443), timeout=10)
        sock = ssl.create_default_context().wrap_socket(raw, server_hostname=self.host)
        try:
            key = base64.b64encode(os.urandom(16)).decode()
            sock.sendall((f'GET {self.path} HTTP/1.1\r\nHost: {self.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                          f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
            head = b''
            while b'\r\n\r\n' not in head:
                chunk = sock.recv(1)
                if not chunk or len(head) > 8192:
                    raise ConnectionError('handshake_failed')
                head += chunk
            if not head.startswith(b'HTTP/1.1 101'):
                raise ConnectionError('handshake_rejected')
            self.send(sock, dict(topic=self.topic, event='phx_join', payload=dict(config=dict(
                broadcast=dict(self=False), presence=dict(key=''), private=False))))
            last_seen = last_beat = time.monotonic()
            while True:
                if time.monotonic() - last_beat >= 25:
                    self.send(sock, dict(topic='phoenix', event='heartbeat', payload={}))
                    last_beat = time.monotonic()
                if time.monotonic() - last_seen > 70:
                    raise ConnectionError('heartbeat_timeout')
                if not sock.pending() and not select.select([sock], [], [], 1)[0]:
                    continue
                message = self.receive(sock)
                if message is None:
                    continue
                last_seen = time.monotonic()
                self.handle(json.loads(message))
        finally:
            sock.close()

    def handle(self, message):
        if message.get('topic') != self.topic:
            return
        if message.get('event') == 'phx_reply' and message.get('payload', {}).get('status') == 'ok':
            self.joined = True
        elif message.get('event') == 'broadcast':
            self.event.set()
        elif message.get('event') in ('phx_error', 'phx_close'):
            raise ConnectionError('channel_closed')

    def send(self, sock, message, opcode=1):
        self.ref += 1
        data = json.dumps(dict(message, ref=str(self.ref))).encode() if opcode == 1 else message
        mask = os.urandom(4)
        size = len(data)
        header = bytes([0x80 | opcode]) + (bytes([0x80 | size]) if size < 126 else
                                           bytes([0xFE]) + struct.pack('!H', size) if size < 65536 else
                                           bytes([0xFF]) + struct.pack('!Q', size))
        sock.sendall(header + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def receive(self, sock):
        parts = []
        while True:
            first, second = self.exact(sock, 2)
            size = second & 0x7F
            if size == 126:
                size = struct.unpack('!H', self.exact(sock, 2))[0]
            elif size == 127:
                size = struct.unpack('!Q', self.exact(sock, 8))[0]
            if size > 1_000_000:
                raise ConnectionError('frame_too_large')
            mask = self.exact(sock, 4) if second & 0x80 else None
            data = self.exact(sock, size)
            if mask:
                data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
            opcode = first & 0x0F
            if opcode == 8:
                raise ConnectionError('server_closed')
            if opcode == 9:
                self.send(sock, data, opcode=10)
                return None
            if opcode == 10:
                return None
            parts.append(data)
            if first & 0x80:
                return b''.join(parts).decode()

    @staticmethod
    def exact(sock, size):
        data = b''
        while len(data) < size:
            chunk = sock.recv(size - len(data))
            if not chunk:
                raise ConnectionError('socket_closed')
            data += chunk
        return data
