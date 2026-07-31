import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * Procedurally drawn transcript sheets. No downloaded assets, no remote fonts: each texture is a
 * small offscreen canvas with a dark acrylic panel, a timestamp chip and redacted "spoken text"
 * bars whose widths come from a seeded generator, so every build renders the same layout.
 */

export type SheetVariant = 'sheet' | 'row' | 'row-locked';

const INK_PANEL = 'rgba(10, 17, 26, 0.94)';
const PANEL_BORDER = 'rgba(243, 239, 230, 0.12)';
const TEXT_BAR = 'rgba(233, 238, 242, 0.68)';
const TEXT_BAR_SOFT = 'rgba(233, 238, 242, 0.38)';
const TEAL_CHIP = '#2ea18f';
const AMBER_CHIP = '#e8b25c';

/** Deterministic 0..1 generator (mulberry32) so sheet layouts never change between frames. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export function createTranscriptTexture(variant: SheetVariant, seed: number): CanvasTexture {
  const width = 512;
  const height = variant === 'sheet' ? 352 : 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (context) {
    const random = seededRandom(seed);

    context.clearRect(0, 0, width, height);
    context.fillStyle = INK_PANEL;
    roundedRect(context, 4, 4, width - 8, height - 8, 22);
    context.fill();
    context.strokeStyle = variant === 'row-locked' ? 'rgba(232, 178, 92, 0.85)' : PANEL_BORDER;
    context.lineWidth = variant === 'row-locked' ? 3 : 2.5;
    roundedRect(context, 4, 4, width - 8, height - 8, 22);
    context.stroke();

    // Timestamp chip.
    context.fillStyle = variant === 'row-locked' ? AMBER_CHIP : TEAL_CHIP;
    roundedRect(context, 28, 26, 92, 30, 14);
    context.fill();

    // Redacted text bars.
    const rows = variant === 'sheet' ? 5 : 1;
    const barTop = variant === 'sheet' ? 84 : 42;
    const barHeight = variant === 'sheet' ? 26 : 34;
    const barGap = 24;

    for (let row = 0; row < rows; row += 1) {
      const barWidth = (0.42 + random() * 0.44) * (width - 96);
      const highlighted = variant !== 'sheet' || (row === 1 && seed % 3 === 0);

      context.fillStyle = highlighted ? TEXT_BAR : TEXT_BAR_SOFT;
      roundedRect(context, variant === 'sheet' ? 32 : 140, barTop + row * (barHeight + barGap), barWidth, barHeight, barHeight / 2);
      context.fill();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Soft teal-lit "footage" for the video screen — a gradient, a light pool, no photography. */
export function createScreenTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 288;
  const context = canvas.getContext('2d');

  if (context) {
    const base = context.createLinearGradient(0, 0, 0, 288);
    base.addColorStop(0, '#0c1d24');
    base.addColorStop(0.55, '#0e2f30');
    base.addColorStop(1, '#071016');
    context.fillStyle = base;
    context.fillRect(0, 0, 512, 288);

    const pool = context.createRadialGradient(340, 120, 12, 340, 120, 210);
    pool.addColorStop(0, 'rgba(94, 214, 194, 0.55)');
    pool.addColorStop(0.5, 'rgba(31, 160, 142, 0.18)');
    pool.addColorStop(1, 'rgba(31, 160, 142, 0)');
    context.fillStyle = pool;
    context.fillRect(0, 0, 512, 288);

    // A restrained horizon line keeps it reading as footage rather than a flat gradient.
    context.fillStyle = 'rgba(233, 238, 242, 0.08)';
    context.fillRect(0, 196, 512, 3);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
