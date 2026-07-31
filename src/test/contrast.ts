/**
 * Test-only WCAG contrast helpers — dependency-free on purpose. Supports the two color forms the
 * token owner actually uses: solid `#rrggbb`/`#rgb` hex and `rgba(r, g, b, a)`. Translucent
 * colors are composited over a concrete background before measuring, because a ring or text is
 * only ever seen flattened onto a real surface.
 */
export type Rgb = { r: number; g: number; b: number };

export function parseHex(value: string): Rgb {
  const hex = value.trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Unsupported hex color: ${value}`);
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function parseColor(value: string): Rgb & { alpha: number } {
  const trimmed = value.trim();
  const rgbaMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/);
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      alpha: rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]),
    };
  }
  return { ...parseHex(trimmed), alpha: 1 };
}

/** Flattens a possibly-translucent foreground onto a solid background. */
export function compositeOver(foreground: string, background: string): Rgb {
  const fg = parseColor(foreground);
  const bg = parseHex(background);
  const mix = (f: number, b: number) => Math.round(fg.alpha * f + (1 - fg.alpha) * b);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b) };
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between a (possibly translucent) foreground and a solid background. */
export function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(compositeOver(foreground, background));
  const bg = relativeLuminance(parseHex(background));
  const [hi, lo] = fg >= bg ? [fg, bg] : [bg, fg];
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads one custom property's raw value out of a CSS source string. */
export function readCssToken(css: string, token: string): string {
  const match = css.match(new RegExp(`${token}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`Token ${token} not found`);
  }
  return match[1].trim();
}
