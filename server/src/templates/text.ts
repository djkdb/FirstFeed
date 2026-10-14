// 원고 → HTML. 원고에는 **강조** 와 줄바꿈만 있다고 보고, 나머지는 모두 글자로 이스케이프한다
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const NBSP = '\u00A0';

/**
 * 렌더링 직전 글 다듬기 (결정 2026-10-15 · 렌더링 직전 글 다듬기). 원고는 바꾸지 않고 그림에 넣는 글만 — 근거 대조는 원고 기준.
 * 줄이 안 바뀌는 공백(U+00A0)으로 묶어서 이런 줄바꿈을 막는다(넘침 측정 2026-10-15 에서 실제로 나온 모양):
 * - 「1,500명 · 87% ·」 / 「3단계」 — 줄 끝에 혼자 남는 「·」: 「·」 앞뒤를 묶는다
 * - 「3분」 / 「20초」 — 이어진 숫자+단위 묶음이 갈림: 숫자+단위 다음 숫자가 오면 그 사이를 묶는다
 * - 「5」 / 「가지」 — 숫자와 띄어 쓴 단위가 갈림: 숫자 뒤 공백 다음 한글이면 묶는다
 */
export function polishForRender(s: string): string {
  return s
    .replace(/[ \t]*·[ \t]*/g, `${NBSP}·${NBSP}`)
    .replace(/(\d[\d,.]*(?:[가-힣%]{1,3})) (?=\d)/g, `$1${NBSP}`)
    .replace(/(\d[\d,.]*%?) (?=[가-힣])/g, `$1${NBSP}`);
}

/** **강조** → <span class="mk">, 빈 줄 없는 \n → 줄바꿈, 빈 줄 → 단락 여백. 렌더링 직전 다듬기를 거친다 */
export function textToHtml(s: string): string {
  return escapeHtml(polishForRender(s.trim()))
    .replace(/\*\*(.+?)\*\*/g, '<span class="mk">$1</span>')
    .replace(/\n{2,}/g, '<span class="br"></span>')
    .replace(/\n/g, '<br>');
}
