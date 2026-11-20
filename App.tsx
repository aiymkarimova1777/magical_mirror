
import React, { useState, useEffect, useRef } from 'react';
import { GameState, Target, Projectile, HandsTracker, Particle } from './types';
import { 
  LEVELS, 
  BALLOON_COLORS, 
  GRAVITY, 
  THROW_FORCE, 
  ARM_THRESHOLD, 
  THROW_THRESHOLD
} from './constants';
import { fetchAiCommentary, decodeBase64, decodeAudioData } from './services/geminiService';

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

interface Flower {
  x: number;
  y: number;
  color: string;
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [levelIdx, setLevelIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [goals, setGoals] = useState<number[]>([5, 10, 15]);
  const [aiMsg, setAiMsg] = useState("Сәлем! Дайынсың ба?");
  const [isCamLoaded, setIsCamLoaded] = useState(false);
  const [showCamera, setShowCamera] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stonesRef = useRef<Projectile[]>([]);
  const targetsRef = useRef<Target[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const landmarksRef = useRef<any>(null);
  const handsStateRef = useRef<HandsTracker>({
    L: { state: 'idle', x: 0, y: 0 },
    R: { state: 'idle', x: 0, y: 0 }
  });

  const cloudsRef = useRef<Cloud[]>([]);
  const flowersRef = useRef<Flower[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const currentLevel = LEVELS[levelIdx];
  const currentGoal = goals[levelIdx];

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playSfx = (type: 'pop' | 'throw' | 'click' | 'win') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(); osc.stop(now + 0.1);
    } else if (type === 'throw') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(); osc.stop(now + 0.2);
    } else if (type === 'click') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.05);
      osc.start(); osc.stop(now + 0.05);
    } else if (type === 'win') {
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now + i * 0.1);
        g.gain.setValueAtTime(0.2, now + i * 0.1);
        g.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.3);
        o.connect(g); g.connect(ctx.destination);
        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.3);
      });
    }
  };

  const initDecorations = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    cloudsRef.current = Array.from({ length: 5 }, () => ({
      x: Math.random() * w,
      y: Math.random() * 200 + 50,
      scale: Math.random() * 0.5 + 0.5,
      speed: Math.random() * 0.5 + 0.2
    }));
    flowersRef.current = Array.from({ length: 45 }, () => ({
      x: Math.random() * w,
      y: h - 130 + Math.random() * 110,
      color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)]
    }));
  };

  useEffect(() => {
    initDecorations();
    window.addEventListener('resize', initDecorations);
    return () => window.removeEventListener('resize', initDecorations);
  }, []);

  const spawnTarget = (w: number, h: number): Target => {
    const lvl = LEVELS[levelIdx];
    return {
      id: Math.random(),
      x: Math.random() * (w - 300) + 150,
      y: Math.random() * (h * 0.4) + 100,
      r: Math.random() * (lvl.r_max - lvl.r_min) + lvl.r_min,
      vx: (Math.random() - 0.5) * lvl.vx,
      color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
      state: 'alive',
      pop_t: 0
    };
  };

  const createPopParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 20; i++) {
      particlesRef.current.push({
        x, y, vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15, life: 1.0, color
      });
    }
  };

  const playCommentary = async (status: string) => {
    const result = await fetchAiCommentary(score, status, currentLevel.name);
    setAiMsg(result.text);
    if (result.audioData) {
      try {
        initAudio();
        const ctx = audioCtxRef.current!;
        const decoded = decodeBase64(result.audioData);
        const buffer = await decodeAudioData(decoded, ctx);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
      } catch (e) { console.warn(e); }
    }
  };

  useEffect(() => {
    const initMP = async () => {
      if (!(window as any).Pose) return;
      const pose = new (window as any).Pose({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });
      pose.setOptions({ modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      pose.onResults((res: any) => {
        landmarksRef.current = res.poseLandmarks;
        if (!isCamLoaded && res.poseLandmarks) setIsCamLoaded(true);
      });
      if (videoRef.current) {
        const camera = new (window as any).Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current) await pose.send({ image: videoRef.current });
          },
          width: 640, height: 480
        });
        camera.start();
      }
    };
    initMP();
  }, []);

  const drawScenery = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#7DD3FC');
    sky.addColorStop(1, '#E0F2FE');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // --- FULLY ROTATING SUN (NO SHADOW, NO HALO) ---
    const sunX = w - 110;
    const sunY = 110;
    const sunR = 48;
    const time = Date.now() * 0.0006;

    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(time); // Rotate EVERYTHING

    // 1. Straight Rays
    ctx.fillStyle = '#FDE047';
    for (let i = 0; i < 16; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 / 16) * i);
      const rayLen = (i % 2 === 0) ? 38 : 24;
      ctx.fillRect(-5, -sunR - 10, 10, -rayLen);
      ctx.restore();
    }

    // 2. Sun Body (No shadowBlur)
    const sunGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, sunR);
    sunGrad.addColorStop(0, '#FFEB3B');
    sunGrad.addColorStop(1, '#FBC02D');
    ctx.fillStyle = sunGrad;
    ctx.beginPath(); 
    ctx.arc(0, 0, sunR, 0, Math.PI * 2); 
    ctx.fill();

    // 3. Sun Face
    ctx.fillStyle = 'rgba(255, 152, 0, 0.3)';
    ctx.beginPath(); ctx.arc(-sunR*0.4, 10, sunR*0.18, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sunR*0.4, 10, sunR*0.18, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#5D4037';
    ctx.beginPath(); ctx.arc(-14, -8, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -8, 5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 4, 16, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.restore();

    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    cloudsRef.current.forEach(c => {
      c.x += c.speed;
      if (c.x > w + 150) c.x = -200;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 30 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x + 40 * c.scale, c.y - 10 * c.scale, 40 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x + 80 * c.scale, c.y, 35 * c.scale, 0, Math.PI * 2);
      ctx.fill();
    });

    // Mountains
    const drawMountain = (x: number, y: number, mw: number, mh: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(x - mw/2, y); ctx.lineTo(x, y - mh); ctx.lineTo(x + mw/2, y); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(x, y - mh);
      ctx.lineTo(x - mw * 0.1, y - mh * 0.75); ctx.lineTo(x, y - mh * 0.7); ctx.lineTo(x + mw * 0.1, y - mh * 0.75);
      ctx.closePath(); ctx.fill();
    };
    drawMountain(w * 0.25, h - 140, 650, 420, '#93C5FD');
    drawMountain(w * 0.75, h - 140, 900, 520, '#60A5FA');

    // Grass
    ctx.fillStyle = '#22C55E';
    ctx.fillRect(0, h - 150, w, 150);

    // Flowers
    flowersRef.current.forEach(f => {
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2); ctx.fill();
    });
  };

  const drawHumanoid = (ctx: CanvasRenderingContext2D, lms: any, w: number, h: number) => {
    const SCALE = 0.35; 
    const TORSO_H = 140 * SCALE;
    const TORSO_W = 85 * SCALE;
    const UPPER_ARM = 70 * SCALE;
    const LOWER_ARM = 65 * SCALE;
    const UPPER_LEG = 80 * SCALE;
    const LOWER_LEG = 75 * SCALE;
    const HEAD_R = 38 * SCALE;

    const getAngle = (p1: any, p2: any) => Math.atan2(p2.y - p1.y, p1.x - p2.x);
    const midShoulderX = (lms[11].x + lms[12].x) / 2;
    const anchorX = (1 - midShoulderX) * w;
    const anchorY = h - (TORSO_H + UPPER_LEG + LOWER_LEG + 40); 

    const joints: any = {};
    joints.midShoulder = { x: anchorX, y: anchorY };
    joints.shoulderL = { x: anchorX - TORSO_W/2, y: anchorY };
    joints.shoulderR = { x: anchorX + TORSO_W/2, y: anchorY };
    joints.hipMid = { x: anchorX, y: anchorY + TORSO_H };
    joints.hipL = { x: anchorX - TORSO_W/2.5, y: anchorY + TORSO_H };
    joints.hipR = { x: anchorX + TORSO_W/2.5, y: anchorY + TORSO_H };

    const calcJoint = (parent: any, p1: any, p2: any, length: number) => {
      const angle = getAngle(p1, p2);
      return { x: parent.x + Math.cos(angle) * length, y: parent.y + Math.sin(angle) * length };
    };

    joints.elbowL = calcJoint(joints.shoulderL, lms[11], lms[13], UPPER_ARM);
    joints.wristL = calcJoint(joints.elbowL, lms[13], lms[15], LOWER_ARM);
    joints.elbowR = calcJoint(joints.shoulderR, lms[12], lms[14], UPPER_ARM);
    joints.wristR = calcJoint(joints.elbowR, lms[14], lms[16], LOWER_ARM);
    joints.kneeL = calcJoint(joints.hipL, lms[23], lms[25], UPPER_LEG);
    joints.ankleL = calcJoint(joints.kneeL, lms[25], lms[27], LOWER_LEG);
    joints.kneeR = calcJoint(joints.hipR, lms[24], lms[26], UPPER_LEG);
    joints.ankleR = calcJoint(joints.kneeR, lms[26], lms[28], LOWER_LEG);

    ctx.lineCap = 'round';
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();
    ctx.moveTo(joints.shoulderL.x, joints.shoulderL.y);
    ctx.lineTo(joints.shoulderR.x, joints.shoulderR.y);
    ctx.lineTo(joints.hipR.x, joints.hipR.y);
    ctx.lineTo(joints.hipL.x, joints.hipL.y);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 15 * SCALE + 6;
    const drawSeg = (a: any, b: any) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
    drawSeg(joints.shoulderL, joints.elbowL); drawSeg(joints.elbowL, joints.wristL);
    drawSeg(joints.shoulderR, joints.elbowR); drawSeg(joints.elbowR, joints.wristR);

    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = 18 * SCALE + 8;
    drawSeg(joints.hipL, joints.kneeL); drawSeg(joints.hipR, joints.kneeR);
    ctx.strokeStyle = '#FFEDD5';
    ctx.lineWidth = 14 * SCALE + 6;
    drawSeg(joints.kneeL, joints.ankleL); drawSeg(joints.kneeR, joints.ankleR);

    const hx = joints.midShoulder.x;
    const hy = joints.midShoulder.y - HEAD_R - (10 * SCALE);
    ctx.fillStyle = '#FFEDD5';
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, hy, HEAD_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath(); ctx.arc(hx - (10 * SCALE), hy - (4 * SCALE), 3 * SCALE, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + (10 * SCALE), hy - (4 * SCALE), 3 * SCALE, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy + (8 * SCALE), 12 * SCALE, 0.4, Math.PI-0.4); ctx.stroke();

    handsStateRef.current.L.x = joints.wristL.x;
    handsStateRef.current.L.y = joints.wristL.y;
    handsStateRef.current.R.x = joints.wristR.x;
    handsStateRef.current.R.y = joints.wristR.y;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    const loop = () => {
      const w = canvas.width = window.innerWidth;
      const h = canvas.height = window.innerHeight;
      drawScenery(ctx, w, h);

      if (gameState === GameState.PLAYING) {
        stonesRef.current.forEach(s => { s.x += s.vx; s.y += s.vy; s.vy += GRAVITY; });
        stonesRef.current = stonesRef.current.filter(s => s.y < h + 100);

        targetsRef.current.forEach(t => {
          if (t.state === 'alive') {
            t.x += t.vx; t.y += Math.sin(Date.now() / 420) * 2.2;
            if (t.x < t.r || t.x > w - t.r) t.vx *= -1;
            stonesRef.current.forEach(s => {
              if (Math.hypot(s.x - t.x, s.y - t.y) < s.r + t.r) {
                t.state = 'popping'; setScore(p => p + 1); createPopParticles(t.x, t.y, t.color);
                playSfx('pop');
              }
            });
          } else t.pop_t++;
        });
        targetsRef.current = targetsRef.current.filter(t => t.pop_t < 20);
        if (targetsRef.current.filter(t => t.state === 'alive').length < currentLevel.spawn) targetsRef.current.push(spawnTarget(w, h));

        particlesRef.current.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.5; p.life -= 0.035; });
        particlesRef.current = particlesRef.current.filter(p => p.life > 0);

        const lms = landmarksRef.current;
        if (lms) {
          drawHumanoid(ctx, lms, w, h);
          [15, 16].forEach(idx => {
            const side = idx === 15 ? 'L' : 'R';
            const wrist = lms[idx];
            if (wrist && wrist.visibility > 0.6) {
              const hState = handsStateRef.current[side];
              if (wrist.y > ARM_THRESHOLD) hState.state = 'armed';
              if (wrist.y < THROW_THRESHOLD && hState.state === 'armed') {
                hState.state = 'idle';
                stonesRef.current.push({ x: hState.x, y: hState.y, vx: (hState.x - w/2) * 0.08, vy: THROW_FORCE, r: 14, trail: [] });
                playSfx('throw');
              }
              const rx = hState.x, ry = hState.y;
              const glow = ctx.createRadialGradient(rx, ry, 0, rx, ry, 35);
              glow.addColorStop(0, hState.state === 'armed' ? '#FACC15' : 'rgba(255,255,255,0.6)');
              glow.addColorStop(1, 'transparent');
              ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(rx, ry, 35, 0, Math.PI*2); ctx.fill();
            }
          });
        }

        stonesRef.current.forEach(s => {
          ctx.fillStyle = '#4F46E5'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
        });

        targetsRef.current.forEach(t => {
          ctx.save();
          const scale = t.state === 'alive' ? 1 : 1 + t.pop_t/10;
          ctx.globalAlpha = t.state === 'alive' ? 1 : 1 - t.pop_t/20;
          ctx.translate(t.x, t.y); ctx.scale(scale, scale);
          ctx.fillStyle = t.color;
          ctx.beginPath(); ctx.ellipse(0, 0, t.r, t.r * 1.25, 0, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-4, t.r * 1.25); ctx.lineTo(4, t.r * 1.25); ctx.lineTo(0, t.r * 1.25 + 6); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, t.r*1.25 + 6); ctx.quadraticCurveTo(5, 15, 0, 35); ctx.stroke();
          ctx.restore();
        });

        particlesRef.current.forEach(p => {
          ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, [gameState, levelIdx]);

  useEffect(() => {
    if (gameState === GameState.PLAYING && score >= currentGoal) {
      if (levelIdx < LEVELS.length - 1) {
        setLevelIdx(prev => prev + 1); setScore(0);
        playCommentary("Wonderful! Алға!");
        playSfx('win');
      } else {
        setGameState(GameState.LEVEL_DONE);
        playCommentary("Victory! Жеңіс!");
        playSfx('win');
      }
    }
  }, [score, gameState, currentGoal]);

  const updateGoal = (idx: number, val: number) => {
    initAudio();
    playSfx('click');
    const newGoals = [...goals];
    newGoals[idx] = Math.max(1, val);
    setGoals(newGoals);
  };

  const handleBackToMenu = () => {
    initAudio();
    playSfx('click');
    stonesRef.current = [];
    targetsRef.current = [];
    setScore(0);
    setGameState(GameState.MENU);
  };

  return (
    <div className="w-full h-full relative overflow-hidden select-none bg-sky-100">
      <canvas ref={canvasRef} className="w-full h-full block relative z-10" />

      {/* GAME UI CONTROLS */}
      <div className="absolute top-4 right-4 flex gap-4 z-[300]">
        {gameState === GameState.PLAYING && (
          <>
            <button 
              onClick={() => { initAudio(); playSfx('click'); setShowCamera(!showCamera); }}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-xl transition-all border-4 border-white
                ${showCamera ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600'}`}
              title={showCamera ? "Камераны жасыру" : "Камераны көрсету"}
            >
              <i className={`fas ${showCamera ? 'fa-video' : 'fa-video-slash'}`}></i>
            </button>
            <button 
              onClick={handleBackToMenu}
              className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center text-2xl shadow-xl hover:bg-rose-600 transition-all border-4 border-white"
              title="Мәзірге қайту"
            >
              <i className="fas fa-home"></i>
            </button>
          </>
        )}
      </div>

      {/* MIRROR BOX - Use style display instead of conditional rendering to keep MediaPipe alive */}
      <div 
        className="absolute bottom-4 right-4 w-[180px] h-[135px] border-4 border-white rounded-[24px] overflow-hidden shadow-2xl z-[100] bg-black transition-opacity duration-300"
        style={{ opacity: showCamera ? 1 : 0, pointerEvents: showCamera ? 'auto' : 'none', display: showCamera ? 'block' : 'none' }}
      >
        <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />
        <div className="absolute top-1 left-1 bg-indigo-500/80 px-2 py-0.5 rounded-md text-[8px] text-white font-black uppercase tracking-widest">АЙНА</div>
      </div>

      {gameState === GameState.PLAYING && (
        <div className="absolute inset-0 pointer-events-none z-50">
          <div className="absolute top-4 left-4 flex flex-col gap-3">
            <div className="bg-white/95 backdrop-blur-md p-4 rounded-[2rem] border-4 border-sky-400 shadow-xl min-w-[160px] flex items-center gap-4 pointer-events-auto">
              <div className="text-5xl animate-bounce">{currentLevel.icon}</div>
              <div>
                <div className="text-4xl font-black text-sky-900 leading-none">
                  {score} <span className="text-lg text-sky-300">/ {currentGoal}</span>
                </div>
              </div>
            </div>
            <div className="bg-indigo-600 text-white p-4 rounded-[1.5rem] shadow-2xl max-w-[280px] border-2 border-white animate-bounce-slow pointer-events-auto">
              <p className="text-sm font-bold italic leading-tight">{aiMsg}</p>
            </div>
          </div>
        </div>
      )}

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-sky-900/20 backdrop-blur-xl flex items-center justify-center p-8 z-[200]">
          <div className="bg-white/95 p-12 rounded-[4rem] border-[10px] border-white max-w-xl w-full text-center shadow-2xl">
            <h1 className="text-5xl font-black text-sky-900 mb-2 tracking-tight uppercase">Сиқырлы Айна</h1>
            <p className="text-slate-400 font-bold mb-8 tracking-[0.3em] uppercase text-[10px]">interactive motion game</p>
            
            <div className="space-y-4 mb-10">
              <h3 className="text-sky-700 font-black text-xs uppercase tracking-widest">Кейіпкерді таңда:</h3>
              <div className="grid grid-cols-3 gap-4">
                {LEVELS.map((lvl, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => { initAudio(); playSfx('click'); setLevelIdx(idx); }}
                    className={`relative p-6 rounded-[2.5rem] border-4 transition-all transform hover:scale-110 active:scale-95 flex flex-col items-center
                      ${levelIdx === idx ? 'border-sky-500 bg-sky-100 shadow-lg' : 'border-transparent bg-sky-50 opacity-60'}`}
                  >
                    <div className="text-6xl mb-2">{lvl.icon}</div>
                    <div className="flex items-center gap-2 mt-2">
                       <div onClick={(e) => { e.stopPropagation(); updateGoal(idx, goals[idx]-1); }} className="w-8 h-8 rounded-full bg-white text-sky-600 font-black flex items-center justify-center text-sm shadow-sm hover:bg-sky-50">-</div>
                       <span className="text-xl font-black text-sky-900 mx-1">{goals[idx]}</span>
                       <div onClick={(e) => { e.stopPropagation(); updateGoal(idx, goals[idx]+1); }} className="w-8 h-8 rounded-full bg-white text-sky-600 font-black flex items-center justify-center text-sm shadow-sm hover:bg-sky-50">+</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={() => { 
                initAudio();
                playSfx('click');
                setScore(0); setGameState(GameState.PLAYING); 
                playCommentary(`Level ${currentLevel.icon} start! Бастадық!`); 
              }}
              disabled={!isCamLoaded}
              className={`w-full py-6 rounded-[3rem] font-black text-3xl shadow-xl transition-all transform hover:scale-105 active:scale-95
                ${isCamLoaded ? 'bg-gradient-to-r from-sky-500 to-indigo-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            >
              {isCamLoaded ? "ОЙЫНДЫ БАСТАУ" : "КАМЕРА ЖҮКТЕЛУДЕ..."}
            </button>
          </div>
        </div>
      )}

      {gameState === GameState.LEVEL_DONE && (
        <div className="absolute inset-0 bg-emerald-500/40 backdrop-blur-2xl flex items-center justify-center p-8 z-[200]">
          <div className="bg-white p-12 rounded-[4rem] max-w-md w-full text-center border-[10px] border-emerald-400 shadow-2xl">
             <div className="text-9xl mb-6 animate-bounce">{currentLevel.icon}</div>
             <h2 className="text-5xl font-black text-emerald-900 mb-4 uppercase">Керемет!</h2>
             <p className="text-emerald-800 text-xl font-bold italic mb-10">{aiMsg}</p>
             <button 
               onClick={handleBackToMenu}
               className="w-full py-6 bg-emerald-500 text-white rounded-[3rem] font-black text-2xl shadow-xl hover:brightness-110"
             >
               БАСТЫ МӘЗІР
             </button>
          </div>
        </div>
      )}

      {!isCamLoaded && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-white/95 px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 border-2 border-sky-200 z-[400] animate-pulse">
          <div className="w-6 h-6 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-black text-sky-800 text-sm tracking-widest uppercase italic">Айна дайындалып жатыр...</span>
        </div>
      )}
    </div>
  );
};

export default App;
