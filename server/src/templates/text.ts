// 원고 → HTML. 원고에는 **강조** 와 줄바꿈만 있다고 보고, 나머지는 모두 글자로 이스케이프한다
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** **강조** → <span class="mk">, 빈 줄 없는 \n → 줄바꿈, 빈 줄 → 단락 여백 */
export function textToHtml(s: string): string {
  return escapeHtml(s.trim())
    .replace(/\*\*(.+?)\*\*/g, '<span class="mk">$1</span>')
    .replace(/\n{2,}/g, '<span class="br"></span>')
    .replace(/\n/g, '<br>');
}
