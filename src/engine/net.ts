// اتصال WebSocket مع الخادم مع إعادة اتصال تلقائية
export class Net {
  ws: WebSocket | null = null;
  status: 'connecting' | 'online' | 'reconnecting' | 'queued' | 'closed' = 'connecting';
  private handlers: Record<string, (m: any) => void> = {};
  private tries = 0; private timer: any; private closed = false;
  onStatus: (s: string, reason?: string) => void = () => {};
  constructor(private code: string, private token: string) {}
  on(t: string, fn: (m: any) => void) { this.handlers[t] = fn; }
  connect() {
    if (this.closed) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`); this.ws = ws;
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'join', token: this.token, code: this.code })); };
    ws.onmessage = (e) => {
      let m: any; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') { this.tries = 0; this.status = 'online'; this.onStatus('online'); }
      if (m.t === 'queue') { this.tries = 0; this.status = 'queued'; }
      if (m.t === 'kicked' || m.t === 'err') { this.closed = true; this.status = 'closed'; this.onStatus('closed', m.reason || m.key); }
      this.handlers[m.t]?.(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      if (this.closed) return;
      this.status = 'reconnecting'; this.onStatus('reconnecting');
      const delay = Math.min(10000, 800 * 2 ** this.tries++);
      this.timer = setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => {};
  }
  send(m: any) { if (this.ws && this.ws.readyState === 1 && this.status === 'online') { this.ws.send(JSON.stringify(m)); return true; } return false; }
  close() { this.closed = true; clearTimeout(this.timer); this.status = 'closed'; try { this.ws?.close(); } catch { /* */ } }
}
