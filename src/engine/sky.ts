// السماء، دورة الليل والنهار، الإضاءة والظلال، والطقس (مطر، عاصفة، ضباب، عاصفة رملية)
import * as THREE from 'three';

const C = (h: string) => new THREE.Color(h);
const NIGHT = C('#0a1128'), DUSK = C('#f08a4b');

export class Sky {
  hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1);
  sun = new THREE.DirectionalLight(0xfff2dc, 1);
  fog = new THREE.FogExp2(0xffffff, 0.01);
  sunMesh: THREE.Mesh; moonMesh: THREE.Mesh; stars: THREE.Points; clouds: THREE.InstancedMesh; rain: THREE.LineSegments; dust: THREE.Points;
  day = C('#8cc4ea'); horizon = C('#f4e2c2'); baseFog = 0.011;
  time = 0.3; weather = 'clear'; wAmt = 0; flash = 0; nextFlash = 5; dayF = 1; thunder: (() => void) | null = null;
  private sky = new THREE.Color(); private fc = new THREE.Color(); private rainPos: Float32Array; private dustPos: Float32Array; private curW = 'clear';

  constructor(public scene: THREE.Scene, env: any, public quality: string) {
    if (env?.sky?.day) this.day = C(env.sky.day);
    if (env?.sky?.horizon) this.horizon = C(env.sky.horizon);
    if (env?.sky?.fog) this.baseFog = env.sky.fog;
    scene.add(this.hemi, this.sun, this.sun.target); scene.fog = this.fog;
    this.sunMesh = new THREE.Mesh(new THREE.CircleGeometry(26, 20), new THREE.MeshBasicMaterial({ color: 0xfff1b8, fog: false, transparent: true }));
    this.moonMesh = new THREE.Mesh(new THREE.CircleGeometry(16, 20), new THREE.MeshBasicMaterial({ color: 0xe8eefc, fog: false, transparent: true }));
    scene.add(this.sunMesh, this.moonMesh);
    const sp = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) { const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 0.95); sp[i * 3] = Math.sin(v) * Math.cos(u) * 420; sp[i * 3 + 1] = Math.cos(v) * 420; sp[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 420; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }));
    scene.add(this.stars);
    const n = quality === 'low' ? 0 : 46;
    this.clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, fog: false }), Math.max(1, n));
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m.makeScale(18 + Math.random() * 34, 3 + Math.random() * 3, 12 + Math.random() * 24); m.setPosition((Math.random() - 0.5) * 700, 150 + Math.random() * 24, (Math.random() - 0.5) * 700); this.clouds.setMatrixAt(i, m); }
    this.clouds.visible = n > 0; this.clouds.frustumCulled = false; scene.add(this.clouds);
    const RN = quality === 'low' ? 500 : 1400;
    this.rainPos = new Float32Array(RN * 6);
    for (let i = 0; i < RN; i++) this.resetDrop(i, true);
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xbfd8ee, transparent: true, opacity: 0.55, fog: false }));
    this.rain.frustumCulled = false; this.rain.visible = false; scene.add(this.rain);
    const DN = quality === 'low' ? 300 : 800;
    this.dustPos = new Float32Array(DN * 3);
    for (let i = 0; i < DN; i++) { this.dustPos[i * 3] = (Math.random() - 0.5) * 40; this.dustPos[i * 3 + 1] = Math.random() * 14 - 3; this.dustPos[i * 3 + 2] = (Math.random() - 0.5) * 40; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xe6c48a, size: 0.14, transparent: true, opacity: 0.8, fog: false }));
    this.dust.frustumCulled = false; this.dust.visible = false; scene.add(this.dust);
  }
  private resetDrop(i: number, any = false) {
    const x = (Math.random() - 0.5) * 36, z = (Math.random() - 0.5) * 36, y = any ? Math.random() * 24 - 6 : 18;
    const p = this.rainPos; p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z; p[i * 6 + 3] = x + 0.08; p[i * 6 + 4] = y - 0.7; p[i * 6 + 5] = z;
  }
  setShadows(on: boolean) {
    this.sun.castShadow = on;
    if (on) { const s = this.sun.shadow; s.mapSize.set(2048, 2048); const c = s.camera; c.left = c.bottom = -56; c.right = c.top = 56; c.near = 1; c.far = 320; s.bias = -0.0006; s.normalBias = 0.05; c.updateProjectionMatrix(); }
  }

  update(dt: number, cam: THREE.Vector3, viewDist: number, underwater: boolean) {
    const ang = (this.time - 0.25) * Math.PI * 2, sy = Math.sin(ang), sx = Math.cos(ang);
    const dayF = THREE.MathUtils.smoothstep(sy, -0.14, 0.22); this.dayF = dayF;
    const dusk = Math.max(0, 1 - Math.abs(sy) / 0.3) * 0.55;
    const target = this.weather === 'clear' ? 0 : 1;
    if (this.curW !== this.weather && this.wAmt < 0.02) this.curW = this.weather;
    this.wAmt += ((this.curW === this.weather ? target : 0) - this.wAmt) * Math.min(1, dt * 0.6);
    const w = this.curW, a = this.wAmt;
    // ألوان السماء
    this.sky.copy(NIGHT).lerp(this.day, dayF).lerp(DUSK, dusk * 0.5);
    this.fc.copy(NIGHT).lerp(this.horizon, dayF).lerp(DUSK, dusk);
    let dim = 1, fogMul = 1;
    if (w === 'rain') { this.sky.lerp(C('#6f7f8f').multiplyScalar(0.35 + dayF * 0.65), a * 0.8); this.fc.lerp(C('#8a97a3').multiplyScalar(0.3 + dayF * 0.7), a * 0.8); dim = 1 - 0.3 * a; fogMul = 1 + a * 1.2; }
    else if (w === 'storm') { this.sky.lerp(C('#3d4654').multiplyScalar(0.3 + dayF * 0.7), a * 0.9); this.fc.lerp(C('#505a68').multiplyScalar(0.3 + dayF * 0.7), a * 0.9); dim = 1 - 0.5 * a; fogMul = 1 + a * 1.8; }
    else if (w === 'fog') { this.sky.lerp(C('#c9d2d8').multiplyScalar(0.25 + dayF * 0.75), a * 0.85); this.fc.lerp(C('#d5dce0').multiplyScalar(0.25 + dayF * 0.75), a); dim = 1 - 0.2 * a; fogMul = 1 + a * 4.5; }
    else if (w === 'sandstorm') { this.sky.lerp(C('#c9a05c').multiplyScalar(0.25 + dayF * 0.75), a * 0.9); this.fc.lerp(C('#d1a865').multiplyScalar(0.25 + dayF * 0.75), a); dim = 1 - 0.35 * a; fogMul = 1 + a * 5; }
    // برق
    if (w === 'storm' && a > 0.5) { this.nextFlash -= dt; if (this.nextFlash <= 0) { this.flash = 0.22; this.nextFlash = 5 + Math.random() * 11; this.thunder?.(); } }
    if (this.flash > 0) { this.flash -= dt; this.sky.lerp(C('#dfe8ff'), 0.6); }
    if (underwater) { this.fc.set('#1d6f8f').multiplyScalar(0.35 + dayF * 0.65); this.sky.copy(this.fc); }
    this.scene.background = this.sky; this.fog.color.copy(this.fc);
    this.fog.density = underwater ? 0.09 : Math.max(this.baseFog * fogMul, 1.75 / viewDist);
    const fl = this.flash > 0 ? 1.4 : 0;
    this.hemi.intensity = (0.32 + 0.95 * dayF) * dim + fl; this.hemi.color.copy(NIGHT).lerp(C('#ffffff'), 0.25 + dayF * 0.75); this.hemi.groundColor.set(0x8a7a66).multiplyScalar(0.4 + dayF * 0.6);
    this.sun.intensity = Math.max(0, dayF * 1.55 * dim * (w === 'clear' ? 1 : 1 - a * 0.5)); this.sun.color.set(0xfff2dc).lerp(DUSK, dusk);
    const sd = new THREE.Vector3(sx * 0.8, Math.max(0.18, sy), 0.42).normalize();
    this.sun.target.position.set(Math.round(cam.x / 4) * 4, cam.y - 6, Math.round(cam.z / 4) * 4); this.sun.position.copy(this.sun.target.position).addScaledVector(sd, 160);
    const sv = new THREE.Vector3(sx * 0.8, sy, 0.42).normalize();
    this.sunMesh.position.copy(cam).addScaledVector(sv, 430); this.sunMesh.lookAt(cam); this.sunMesh.visible = sy > -0.15 && !underwater; (this.sunMesh.material as any).opacity = 1 - a * 0.85;
    this.moonMesh.position.copy(cam).addScaledVector(sv, -430); this.moonMesh.lookAt(cam); this.moonMesh.visible = sy < 0.15 && !underwater; (this.moonMesh.material as any).opacity = 1 - a * 0.85;
    this.stars.position.copy(cam); (this.stars.material as any).opacity = (1 - dayF) * (1 - a); this.stars.rotation.z = this.time * 6.28;
    if (this.clouds.visible) { this.clouds.position.set(cam.x + ((performance.now() / 500) % 300) - 150, 0, cam.z); (this.clouds.material as any).color.setScalar(0.25 + dayF * 0.75 * dim); }
    // مطر
    const raining = (w === 'rain' || w === 'storm') && a > 0.05 && !underwater;
    this.rain.visible = raining;
    if (raining) {
      const p = this.rainPos, sp = (w === 'storm' ? 34 : 24) * dt, n = (p.length / 6) | 0;
      for (let i = 0; i < n; i++) { p[i * 6 + 1] -= sp; p[i * 6 + 4] -= sp; if (p[i * 6 + 4] < -8) this.resetDrop(i); }
      this.rain.geometry.attributes.position.needsUpdate = true; this.rain.position.copy(cam); (this.rain.material as any).opacity = 0.55 * a;
    }
    const dusty = w === 'sandstorm' && a > 0.05 && !underwater;
    this.dust.visible = dusty;
    if (dusty) {
      const p = this.dustPos, n = (p.length / 3) | 0;
      for (let i = 0; i < n; i++) { p[i * 3] += 16 * dt; p[i * 3 + 1] += Math.sin(i + performance.now() / 300) * dt; if (p[i * 3] > 20) p[i * 3] = -20; }
      this.dust.geometry.attributes.position.needsUpdate = true; this.dust.position.copy(cam); (this.dust.material as any).opacity = 0.8 * a;
    }
  }
  isNight() { return this.time < 0.22 || this.time > 0.79; }
}
