// نقطة تشغيل الخادم: API + WebSocket + الملفات الثابتة للواجهتين (/play و /admin)
import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { DATA_DIR } from './db.ts';
import { seed } from './seed.ts';
import { bootstrapAdmin } from './auth.ts';
import { api } from './api.ts';
import { admin } from './admin.ts';
import { hub } from './hub.ts';

seed();
bootstrapAdmin();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' ws: wss:; worker-src 'self' blob:; frame-ancestors 'self'");
  next();
});
// رفع الأصوات يصل كجسم ثنائي ويُعالَج داخل موجّه الإدارة
app.use((req, res, next) => (req.path.startsWith('/api/admin/sounds') && (req.method === 'POST' || (req.method === 'PUT' && req.path.endsWith('/file'))) ? next() : express.json({ limit: '200kb' })(req, res, next)));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/admin', admin);
app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));
app.use('/uploads', express.static(resolve(DATA_DIR, 'uploads'), { maxAge: '7d', index: false }));

const dist = resolve('dist');
app.use(express.static(dist, { index: false, maxAge: '1h' }));
const page = (f: string) => (_req: any, res: any) => (existsSync(resolve(dist, f)) ? res.sendFile(resolve(dist, f)) : res.status(503).send('Run "npm run build" first.'));
app.get('/', (_req, res) => res.redirect('/play'));
app.get(/^\/play(\/.*)?$/, page('play.html'));
app.get(/^\/admin(\/.*)?$/, page('admin.html'));
app.use((err: any, _req: any, res: any, _next: any) => { res.status(err?.status || 400).json({ error: err?.type === 'entity.too.large' ? 'too_large' : 'bad_request' }); });

const server = createServer(app);
hub.attach(server);
const port = Number(process.env.PORT || 8080);
server.listen(port, () => console.log(`عالم العرب يعمل على http://localhost:${port}/play  —  الإدارة: /admin`));
const stop = () => { hub.shutdown(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
