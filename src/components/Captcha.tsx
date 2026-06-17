import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface CaptchaProps {
  code: string;
  onRefresh: () => void;
}

const WIDTH = 160;
const HEIGHT = 56;

export default function Captcha({ code, onRefresh }: CaptchaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `rgba(${rand(80, 180)}, ${rand(80, 180)}, ${rand(80, 180)}, 0.5)`;
      ctx.lineWidth = rand(1, 2);
      ctx.beginPath();
      ctx.moveTo(rand(0, WIDTH), rand(0, HEIGHT));
      ctx.lineTo(rand(0, WIDTH), rand(0, HEIGHT));
      ctx.stroke();
    }

    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${rand(60, 150)}, ${rand(60, 150)}, ${rand(60, 150)}, 0.4)`;
      ctx.beginPath();
      ctx.arc(rand(0, WIDTH), rand(0, HEIGHT), rand(1, 2), 0, Math.PI * 2);
      ctx.fill();
    }

    const colors = ['#1e40af', '#0f766e', '#b45309', '#9f1239', '#334155'];
    const charWidth = (WIDTH - 24) / code.length;
    for (let i = 0; i < code.length; i++) {
      ctx.save();
      const x = 12 + charWidth * i + charWidth / 2;
      const y = HEIGHT / 2;
      ctx.translate(x, y);
      ctx.rotate(((rand(-25, 25)) * Math.PI) / 180);
      ctx.font = `bold ${rand(26, 32)}px Georgia, serif`;
      ctx.fillStyle = colors[rand(0, colors.length - 1)];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(code[i], 0, rand(-3, 3));
      ctx.restore();
    }
  }, [code]);

  return (
    <div className="flex items-center gap-3">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="rounded-xl border border-slate-200 select-none"
        aria-label="Güvenlik kodu görseli"
      />
      <button
        type="button"
        onClick={onRefresh}
        className="p-3 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 transition-colors"
        title="Kodu yenile"
        aria-label="Güvenlik kodunu yenile"
      >
        <RefreshCw size={18} />
      </button>
    </div>
  );
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
