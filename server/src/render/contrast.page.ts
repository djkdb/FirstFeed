/// <reference lib="dom" />
// 그림 위 글자의 명암비를 브라우저 안에서 잰다 (결정 2026-10-18 · 그림 바탕 표지). render.ts 가 page.evaluate 로 넘긴다.
// 순서: ① 글자색과 글자 줄 사각형을 모은다 ② (render.ts 가) 글자를 투명하게 하고 화면을 찍는다 ③ 그 PNG 의 화소 밝기로 계산
// 이 파일의 함수는 브라우저에서 돌므로 Node API·바깥 변수를 쓰지 않는다

export interface PhotoSlot {
  slot: string;
  /** 글자 줄 사각형(글자가 실제로 있는 곳) */
  rects: Array<{ x: number; y: number; w: number; h: number }>;
  /** 칸 안에서 쓰인 글자색들(강조 글자 포함), "rgb(r, g, b)" */
  colors: string[];
}

export interface SlotContrast {
  slot: string;
  /** 가장 나쁜 글자색 기준 명암비 */
  ratio: number;
  /** 글자 뒤 화소 밝기(상대 휘도)의 아래·위 분위값 — 기록용 */
  lumLow: number;
  lumHigh: number;
}

export function collectPhotoSlots(): PhotoSlot[] {
  return [...document.querySelectorAll('[data-on-photo]')].map((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5).map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
    const colors = new Set<string>([getComputedStyle(el).color]);
    for (const child of el.querySelectorAll('*')) if ([...child.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) colors.add(getComputedStyle(child).color);
    return { slot: (el as HTMLElement).dataset.slot ?? '?', rects, colors: [...colors] };
  });
}

/** 글자를 지운 화면(PNG base64)에서 칸마다 글자 뒤 밝기를 재고, 글자색과의 명암비를 낸다. q: 분위(0.95 = 가장 밝은 5% 경계) */
export async function contrastInPage(arg: { png: string; slots: PhotoSlot[]; q: number }): Promise<SlotContrast[]> {
  const img = new Image();
  img.src = `data:image/png;base64,${arg.png}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).slice(0, 3).map(Number) as [number, number, number];
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return arg.slots.map((s) => {
    const ls: number[] = [];
    for (const r of s.rects) {
      const x = Math.max(0, Math.floor(r.x));
      const y = Math.max(0, Math.floor(r.y));
      const w = Math.min(canvas.width - x, Math.ceil(r.w));
      const h = Math.min(canvas.height - y, Math.ceil(r.h));
      if (w <= 0 || h <= 0) continue;
      const d = ctx.getImageData(x, y, w, h).data;
      // 화소를 모두 보면 느려서 2px 간격으로 — 글자 획보다 촘촘하다
      for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) {
        const k = (j * w + i) * 4;
        ls.push(lum(d[k]!, d[k + 1]!, d[k + 2]!));
      }
    }
    if (ls.length === 0) return { slot: s.slot, ratio: 21, lumLow: 0, lumHigh: 0 };
    ls.sort((a, b) => a - b);
    const lumLow = ls[Math.floor((1 - arg.q) * (ls.length - 1))]!;
    const lumHigh = ls[Math.floor(arg.q * (ls.length - 1))]!;
    // 밝은 글자는 가장 밝은 바탕에서, 어두운 글자는 가장 어두운 바탕에서 가장 나쁘다 — 두 끝을 다 보고 작은 쪽
    const worst = Math.min(...s.colors.map((c) => {
      const t = lum(...parse(c));
      return Math.min(ratio(t, lumHigh), ratio(t, lumLow));
    }));
    return { slot: s.slot, ratio: Math.round(worst * 100) / 100, lumLow, lumHigh };
  });
}
