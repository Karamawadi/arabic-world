// عميل API مشترك (واجهة اللاعب ولوحة الإدارة تستخدمان مفاتيح تخزين مختلفة)
export class ApiError extends Error { constructor(public code: string, public status: number) { super(code); } }
export class Api {
  token: string | null;
  constructor(private storeKey: string) { this.token = localStorage.getItem(storeKey); }
  setToken(t: string | null) { this.token = t; if (t) localStorage.setItem(this.storeKey, t); else localStorage.removeItem(this.storeKey); }
  async req(method: string, path: string, body?: any, raw?: Blob | ArrayBuffer): Promise<any> {
    const h: Record<string, string> = {};
    if (this.token) h.authorization = 'Bearer ' + this.token;
    if (body !== undefined) h['content-type'] = 'application/json';
    if (raw) h['content-type'] = 'application/octet-stream';
    let r: Response;
    try { r = await fetch('/api' + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) }); } catch { throw new ApiError('network', 0); }
    let j: any = null; try { j = await r.json(); } catch { /* */ }
    if (!r.ok) throw new ApiError(j?.error || 'server_error', r.status);
    return j;
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b: any = {}) => this.req('POST', p, b);
  put = (p: string, b: any = {}) => this.req('PUT', p, b);
  patch = (p: string, b: any = {}) => this.req('PATCH', p, b);
  del = (p: string) => this.req('DELETE', p);
}
export type TFn = (k: string, a?: Record<string, any>) => string;
export function makeT(dict: Record<string, string>): TFn {
  return (k, a) => { let s = dict[k]; if (s === undefined) return k; if (a) for (const x in a) s = s.split('{' + x + '}').join(String(a[x] ?? '')); return s; };
}
export const isTouch = () => (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
