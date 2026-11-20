// 캐릭터 저장 · 계정 캐릭터로 쓰기. SQL 은 이 파일에만
import type { Db } from '../db/index.ts';
import { saveEdit } from '../identity/edit.ts';
import { activeProfile } from '../identity/store.ts';
import { characterPrompts, defaultCharacter, type CharacterSpec } from './character.ts';
import { currentSelection } from './store.ts';

export interface SavedCharacter {
  id: number;
  name: string;
  spec: CharacterSpec;
  updatedAt: string;
}
type Row = Record<string, unknown>;
const toChar = (r: Row): SavedCharacter => ({ id: Number(r.id), name: String(r.name), spec: JSON.parse(String(r.spec_json)) as CharacterSpec, updatedAt: String(r.updated_at) });

export const listCharacters = (db: Db, brandId: number): SavedCharacter[] => (db.prepare('SELECT * FROM characters WHERE brand_id = ? ORDER BY updated_at DESC, id DESC').all(brandId) as Row[]).map(toChar);
export function getCharacter(db: Db, brandId: number, id: number): SavedCharacter | null {
  const r = db.prepare('SELECT * FROM characters WHERE brand_id = ? AND id = ?').get(brandId, id) as Row | undefined;
  return r ? toChar(r) : null;
}
export function saveCharacter(db: Db, brandId: number, spec: CharacterSpec, id: number | null): number {
  if (id != null) {
    db.prepare("UPDATE characters SET name = ?, spec_json = ?, updated_at = datetime('now') WHERE brand_id = ? AND id = ?").run(spec.name, JSON.stringify(spec), brandId, id);
    return id;
  }
  return Number(db.prepare('INSERT INTO characters (brand_id, name, spec_json) VALUES (?, ?, ?)').run(brandId, spec.name, JSON.stringify(spec)).lastInsertRowid);
}
export const deleteCharacter = (db: Db, brandId: number, id: number) => db.prepare('DELETE FROM characters WHERE brand_id = ? AND id = ?').run(brandId, id).changes > 0;

/** 프로필 「보여 주는 방식」에 들어갈 글 — 「캐릭터」가 있어야 카드 그림 규칙이 사람 대신 캐릭터로 본다(cardPeopleRule) */
export const presenceFor = (name: string) => `캐릭터 ${name}(직접 만든 캐릭터 — 참고 그림을 따름)`;

/**
 * 원래 보여 주는 방식(「일부만 — 손이랑 컵만 나오게」 같은 사진 · 릴스 촬영 방식)은 지우지 않고 뒤에 남긴다 —
 * 처음엔 캐릭터 글로 통째로 덮어 사용자가 적은 촬영 방식이 사라졌다(사용자 시뮬레이션 2026-11-09). 칸 길이(100자)를 넘으면 원래 글을 줄인다.
 * 이미 캐릭터 글이 있으면(다른 캐릭터로 바꾸기) 그 부분만 바꾼다
 */
export function presenceWithCharacter(name: string, before: string | null, max = 100): string {
  const head = presenceFor(name);
  const rest = (before ?? '').replace(/캐릭터 [A-Za-z][A-Za-z0-9]*\(직접 만든 캐릭터 — 참고 그림을 따름\)( · 사진은 )?/, '').trim();
  if (!rest) return head;
  const sep = ' · 사진은 ';
  const room = max - head.length - sep.length;
  if (room < 4) return head;
  return `${head}${sep}${[...rest].length > room ? `${[...rest].slice(0, room - 1).join('')}…` : rest}`;
}

/**
 * 계정 캐릭터로 쓰기: 지금 프로필을 그대로 두고 「보여 주는 방식」만 바꾼 새 판(직접 수정과 같은 길 — 바로 활성, 되돌리기 가능, 결정 2026-10-14).
 * 사용자가 고른 것이라 출처는 edit(허용 출처 4번) — 카드 그림 프롬프트가 이 이름을 불러도 근거 규칙을 통과한다
 */
export function useAsAccountCharacter(db: Db, brandId: number, c: SavedCharacter): { profileId: number; changed: boolean } {
  const p = activeProfile(db, brandId);
  if (!p) throw new Error('적용 중인 프로필이 없습니다. 「정체성」에서 프로필을 먼저 확정하세요.');
  // 이미 이 캐릭터면 새 판을 만들지 않는다 — 다시 누르면 「바뀐 것이 없습니다」 오류가 보였다(사용자 시뮬레이션 2026-11-09)
  const presence = presenceWithCharacter(c.name, p.presence?.text ?? null);
  if (presence === p.presence?.text) return { profileId: p.id, changed: false };
  const profileId = saveEdit(db, p.id, {
    accountLine: p.accountLine,
    audience: p.audience,
    pillars: p.pillars.map((x) => ({ id: x.id, name: x.name, description: x.description })),
    voiceRules: p.voiceRules.map((x) => x.text),
    avoid: p.avoid.map((x) => x.text),
    presence,
  }).profileId;
  return { profileId, changed: true };
}

/**
 * 지금 계정 캐릭터(프로필 「보여 주는 방식」의 캐릭터 이름 = 저장한 캐릭터)와 그 고정 설명. 없으면 null.
 * 카드 그림 프롬프트는 이름만 부른다(「follow the character's reference image」) — 그림 도구가 생김새를 알도록 복사 · 업로드 폴더에서 앞에 붙인다
 */
export function accountCharacter(db: Db, brandId: number): { name: string; dna: string } | null {
  const presence = activeProfile(db, brandId)?.presence?.text ?? '';
  const m = /캐릭터 ([A-Za-z][A-Za-z0-9]*)\(직접 만든 캐릭터/.exec(presence);
  if (!m) return null;
  const c = listCharacters(db, brandId).find((x) => x.name === m[1]);
  const palette = currentSelection(db, brandId).palette?.colors;
  if (!c || !palette) return null;
  return { name: c.name, dna: characterPrompts({ ...defaultCharacter(), ...c.spec }, palette).dna };
}
