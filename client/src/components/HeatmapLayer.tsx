import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import type { Emergency } from '../services/api';

interface Props {
  emergencies: Emergency[];
  visible: boolean;
}

function heatConfig(em: Emergency): { radius: number; rgb: string; opacity: number } {
  const s = Math.min(Math.max(em.severity || 1, 1), 5);
  const radius = 40 + s * 20; // 60px → 140px based on severity

  if (em.status === 'COMPLETED') {
    return { radius: radius * 0.7, rgb: '34, 197, 94', opacity: 0.35 };
  }
  if (em.status === 'ASSIGNED') {
    return { radius, rgb: '245, 158, 11', opacity: 0.6 };
  }
  // WAITING — most urgent, brightest
  const colors: Record<number, string> = {
    1: '250, 204, 21',   // yellow
    2: '251, 146, 60',   // orange
    3: '239, 68, 68',    // red
    4: '220, 38, 38',    // deep red
    5: '190, 18, 60',    // crimson
  };
  return { radius, rgb: colors[s], opacity: 0.75 };
}

export default function HeatmapLayer({ emergencies, visible }: Props) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = map.getContainer();
    const w = container.clientWidth  || 800;
    const h = container.clientHeight || 600;
    canvas.width  = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    // Draw in order: completed → assigned → waiting (so urgent ones are on top)
    const sorted = [...emergencies].sort((a, b) => {
      const order = { COMPLETED: 0, ASSIGNED: 1, WAITING: 2 };
      return (order[a.status] ?? 0) - (order[b.status] ?? 0);
    });

    for (const em of sorted) {
      const pt = map.latLngToContainerPoint([em.latitude, em.longitude]);
      const { radius, rgb, opacity } = heatConfig(em);

      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
      grad.addColorStop(0,    `rgba(${rgb}, ${opacity})`);
      grad.addColorStop(0.3,  `rgba(${rgb}, ${opacity * 0.75})`);
      grad.addColorStop(0.65, `rgba(${rgb}, ${opacity * 0.3})`);
      grad.addColorStop(1,    `rgba(${rgb}, 0)`);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }, [map, emergencies]);

  useEffect(() => {
    if (!visible) {
      canvasRef.current?.remove();
      canvasRef.current = null;
      return;
    }

    const container = map.getContainer();
    const canvas = document.createElement('canvas');
    canvas.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'pointer-events: none',
      'z-index: 500',
    ].join(';');
    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;
    container.appendChild(canvas);
    canvasRef.current = canvas;

    // Small delay so map has finished laying out
    const t = setTimeout(draw, 80);

    map.on('move zoom resize', draw);
    return () => {
      clearTimeout(t);
      map.off('move zoom resize', draw);
      canvasRef.current?.remove();
      canvasRef.current = null;
    };
  }, [visible, map]);

  useEffect(() => {
    if (visible) draw();
  }, [emergencies, visible, draw]);

  return null;
}
