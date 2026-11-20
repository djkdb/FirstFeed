// 카드 그림 파일 이름을 화면 카드 번호에 맞춘다 — AI 가 본문 순서로 「card-03」이라 지어 「4번 카드」 아래 보이는 일이 있었다(사용자 시뮬레이션 2026-11-09).
// 저장된 이름은 그대로 두고 보일 때 · 업로드 폴더에 쓸 때만 바꾼다(화면 · 영상 = 같은 함수)
export function cardImageName(idx: number, filename: string): string {
  const no = String(idx + 1).padStart(2, '0');
  const rest = filename.replace(/^card-\d+-?/, '');
  return `card-${no}${rest && rest !== '.png' ? `-${rest.replace(/^-/, '')}` : '.png'}`;
}

/** 계정 캐릭터의 고정 설명을 앞에 붙인 프롬프트 — 그림 도구는 캐릭터 이름만으로는 생김새를 모른다 */
export function withCharacter(prompt: string, character: { name: string; dna: string } | null): string {
  return character ? `${character.name}: ${character.dna} ${prompt}` : prompt;
}
