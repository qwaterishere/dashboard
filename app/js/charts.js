// Чистые SVG-помощники для пончиковых диаграмм (продажи, склад).

/** Дуга окружности от угла a0 до a1 (в градусах, 0 — сверху). */
export function describeArc(cx, cy, r, a0, a1) {
  const point = (a) => {
    const x = (a - 90) * Math.PI / 180;
    return [cx + r * Math.cos(x), cy + r * Math.sin(x)];
  };
  const [x1, y1] = point(a0);
  const [x2, y2] = point(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Затемнить/осветлить hex-цвет на amt (для градиента сегмента). */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
