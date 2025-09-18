import { seededRng } from "./rng";

export type Chunk = {
  belt: number; biome: string; mobs: {type:string; lvl:number}[];
  crateTier: "ring-outer" | "ring-mid" | "ring-inner";
  portal: { requires: Array<{stat:string; min:number}> };
  flags: { bossGate: boolean; onPathOfAscension: boolean };
};

export function beltIndex(x: number, y: number, size: number, belts=100) {
  // Centered coords: range ~[-half, +half]
  const half = Math.floor(size/2);
  const dx = half - Math.abs(x);
  const dy = half - Math.abs(y);
  const fromEdge = Math.min(dx, dy); // 0 @ edge → half @ center
  const idx = Math.max(1, Math.min(belts, Math.ceil(((fromEdge+1)/(half+1))*belts)));
  return idx;
}

export function wrap(v: number, size: number) {
  return (v % size + size) % size;
}

export function isOnPoA(x: number, y: number) {
  return x === y || x === -y;
}

export function genChunk(worldId: number, x: number, y: number, size: number, WORLD_SEED: string): Chunk {
  const belt = beltIndex(x, y, size, 100);
  const rng = seededRng(`${WORLD_SEED}:${worldId}:${x},${y}:b${belt}`);
  const biome = ["rust-desert","ashen-plain","vine-thicket","crystal-salt"][Math.floor(rng()*4)];
  const mobBase = Math.floor(belt/3)+1;
  const mobs = Array.from({length: 1 + (rng() > 0.7 ? 1 : 0)}).map(() => ({
    type: rng() > 0.5 ? "crawler":"scav",
    lvl: mobBase + Math.floor(rng()*3),
  }));
  const crateTier = belt < 34 ? "ring-outer" : belt < 67 ? "ring-mid" : "ring-inner";
  const bossGate = (beltIndex(wrap(x+1,size), y, size, 100) > belt); // moving inward crosses belt → boss
  const requires = [{stat: "DEF", min: Math.max(5, Math.floor(belt*0.9))}];
  return { belt, biome, mobs, crateTier, portal: {requires}, flags: {bossGate, onPathOfAscension: isOnPoA(x,y)}};
}
