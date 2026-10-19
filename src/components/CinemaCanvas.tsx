import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface CinemaCanvasProps {
  mood: number; // 0 = websites (crimson), 1 = apps (steel)
}

export const CinemaCanvas: React.FC<CinemaCanvasProps> = ({ mood }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [glReady, setGlReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        antialias: false,
        powerPreference: 'high-performance'
      });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const BEAM_GLSL = `
      uniform vec2 uSrc; uniform vec2 uAxis; uniform float uAspect;
      vec3 beam(vec2 p){
        vec2 d = p - uSrc;
        float along = dot(d, uAxis);
        float across = dot(d, vec2(-uAxis.y, uAxis.x));
        return vec3(along, across, .035 + max(along, 0.) * .27);
      }
    `;

    const BG_VERT = `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const BG_FRAG = `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime, uMood, uAspect;
      ${BEAM_GLSL}
      float h21(vec2 p){
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float vn(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p){
        float a = 0.5, s = 0.0;
        for(int i = 0; i < 3; i++){
          s += a * vn(p);
          p = p * 2.03 + 7.1;
          a *= 0.5;
        }
        return s;
      }
      void main(){
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        vec3 b = beam(p);
        float edge = abs(b.y) / b.z;
        float cone = smoothstep(1.0, 0.2, edge) * smoothstep(0.0, 0.18, b.x);
        float haze = fbm(vec2(b.y * 6.0, b.x * 1.6 - uTime * 0.04));
        float L = cone * exp(-max(b.x, 0.0) * 1.15) * (0.45 + 0.9 * haze) * 0.8;
        float halo = exp(-length(p - uSrc) * 3.2) * 0.55 * 0.8;

        vec3 warm = vec3(1.0, 0.86, 0.8), cool = vec3(0.62, 0.74, 1.0);
        vec3 red = vec3(0.93, 0.05, 0.1), steel = vec3(0.25, 0.4, 0.9);
        vec3 core = mix(warm, cool, uMood * 0.55);
        vec3 rim = mix(red, steel, uMood * 0.7);
        vec3 beamCol = mix(rim, core, smoothstep(0.9, 0.1, edge));

        vec3 col = vec3(0.045, 0.045, 0.052);
        col += beamCol * L * 0.55 + rim * halo;
        col += rim * exp(-length(p + vec2(0.5 * uAspect, 0.45)) * 2.2) * 0.05 * 1.2;
        
        float v = 1.0 - dot(p * vec2(0.9, 1.1), p * vec2(0.9, 1.1)) * 0.75;
        col *= clamp(v, 0.0, 1.0);
        col += (h21(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.028;
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const uniforms = {
      uTime: { value: 0 },
      uMood: { value: mood },
      uAspect: { value: window.innerWidth / window.innerHeight },
      uSrc: { value: new THREE.Vector2(0.38, 0.48) },
      uAxis: { value: new THREE.Vector2(-0.88, -0.47).normalize() }
    };

    const bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      uniforms,
      depthWrite: false,
      depthTest: false
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    scene.add(quad);

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      uniforms.uAspect.value = w / h;
    };

    onResize();
    window.addEventListener('resize', onResize);
    setGlReady(true);

    let animId = 0;
    const startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) * 0.001;
      uniforms.uTime.value = elapsed;
      uniforms.uMood.value = THREE.MathUtils.lerp(uniforms.uMood.value, mood, 0.05);
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      bgMat.dispose();
      quad.geometry.dispose();
    };
  }, [mood]);

  return (
    <>
      <canvas
        ref={canvasRef}
        id="cinema"
        className={`fixed inset-0 w-full h-full pointer-events-none z-0 transition-opacity duration-1000 ${
          glReady ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {!glReady && (
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background:
              'radial-gradient(120% 70% at 82% -12%, rgba(229,9,20,0.3) 0%, transparent 60%), radial-gradient(60% 50% at 8% 112%, rgba(229,9,20,0.08) 0%, transparent 70%), linear-gradient(180deg, #09090b 0%, #0d0d0e 100%)'
          }}
        />
      )}
    </>
  );
};
