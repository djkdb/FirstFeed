// 인스타 글자 수 칸 옆의 「확인 대기」 안내 (PRD v0.2 FR-BR-1).
// 30·150 과 이모지 세는 방식은 외부 자료로만 알고 실제 앱에서 확인하지 못해서, 앱은 넘치지 않게 엄하게 센다
// (CLAUDE.md 결정 2026-10-14 · 브랜딩 키트 설계). 사용자가 확인하면 설정 brand.instagramCountConfirmed 를 켠다.

export const COUNT_PENDING_NOTE = '인스타 실제 글자 수 세는 방식은 확인 대기';
export const COUNT_PENDING_DETAIL = '숫자(30·150)와 이모지를 몇 자로 세는지 인스타 앱에서 아직 확인하지 못했어요. 넘치지 않게 엄하게 세요(글자 수와 UTF-16 길이 중 큰 값).';

/** 확인하기 전이면 짧은 안내와 풀어 쓴 설명, 확인했으면 null */
export function countNote(confirmed: boolean): { note: string; detail: string } | null {
  return confirmed ? null : { note: COUNT_PENDING_NOTE, detail: COUNT_PENDING_DETAIL };
}
