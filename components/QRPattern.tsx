type Props = {
  className?: string;
};

const SIZE = 21;
const CELL = 10;

function isFinder(row: number, col: number) {
  const corners: [number, number][] = [
    [0, 0],
    [0, SIZE - 7],
    [SIZE - 7, 0],
  ];
  for (const [r0, c0] of corners) {
    const r = row - r0;
    const c = col - c0;
    if (r < 0 || r > 6 || c < 0 || c > 6) continue;
    const onRing = r === 0 || r === 6 || c === 0 || c === 6;
    const onCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
    return onRing || onCore;
  }
  return false;
}

function pseudoRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function QRPattern({ className }: Props) {
  const cells: { x: number; y: number }[] = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const inFinderZone =
        (row < 7 && col < 7) ||
        (row < 7 && col >= SIZE - 7) ||
        (row >= SIZE - 7 && col < 7);
      const filled = inFinderZone
        ? isFinder(row, col)
        : pseudoRandom(row * SIZE + col + 1) > 0.55;
      if (filled) cells.push({ x: col * CELL, y: row * CELL });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE * CELL} ${SIZE * CELL}`}
      className={className}
      fill="currentColor"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {cells.map((cell) => (
        <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width={CELL} height={CELL} />
      ))}
    </svg>
  );
}
