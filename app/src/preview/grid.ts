// 인스타 프로필 격자 칸 그리기 — 카드(4:5)의 양옆을 가린 모양. 가림 값은 서버 설정 render.safeArea.feed(결정 2026-10-18
// 「격자 가림 영역: 확인됨」 — 카드 좌우 34px)를 받아 쓴다. 피드 표지는 위아래를 가리지 않아(y=0) 가로만 자른다.
export interface GridSpec {
  card: { width: number; height: number };
  safe: { x: number; y: number; w: number; h: number };
}

export interface CellBox {
  /** CSS aspect-ratio */
  aspect: string;
  /** 칸 너비에 대한 그림 너비(%) — 가린 만큼 그림이 칸보다 넓다 */
  imgWidthPct: number;
  /** 그림을 왼쪽으로 민 정도(%) — 왼쪽 가림만큼 */
  imgLeftPct: number;
  /** 「가려지는 곳 보기」에서 양옆 띠 하나의 너비(%) */
  hiddenPct: number;
}

/** showHidden 이면 카드 전체를 보이고 가려지는 띠를 표시, 아니면 격자처럼 잘라 보인다 */
export function cellBox(g: GridSpec, showHidden: boolean): CellBox {
  if (showHidden) return { aspect: `${g.card.width} / ${g.card.height}`, imgWidthPct: 100, imgLeftPct: 0, hiddenPct: (g.safe.x / g.card.width) * 100 };
  return { aspect: `${g.safe.w} / ${g.card.height}`, imgWidthPct: (g.card.width / g.safe.w) * 100, imgLeftPct: -(g.safe.x / g.safe.w) * 100, hiddenPct: 0 };
}
