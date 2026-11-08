// 캐릭터 저장 · 계정 캐릭터로 쓰기. SQL 은 이 파일에만
import type { Db } from '../db/index.ts';
import { saveEdit } from '../identity/edit.ts';
import { activeProfile } from '../identity/store.ts';
import type { CharacterSpec } from './character.ts';

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
 * 계정 캐릭터로 쓰기: 지금 프로필을 그대로 두고 「보여 주는 방식」만 바꾼 새 판(직접 수정과 같은 길 — 바로 활성, 되돌리기 가능, 결정 2026-10-14).
 * 사용자가 고른 것이라 출처는 edit(허용 출처 4번) — 카드 그림 프롬프트가 이 이름을 불러도 근거 규칙을 통과한다
 */
export function useAsAccountCharacter(db: Db, brandId: number, c: SavedCharacter): number {
  const p = activeProfile(db, brandId);
  if (!p) throw new Error('적용 중인 프로필이 없습니다. 「정체성」에서 프로필을 먼저 확정하세요.');
  return saveEdit(db, p.id, {
    accountLine: p.accountLine,
    audience: p.audience,
    pillars: p.pillars.map((x) => ({ id: x.id, name: x.name, description: x.description })),
    voiceRules: p.voiceRules.map((x) => x.text),
    avoid: p.avoid.map((x) => x.text),
    presence: presenceFor(c.name),
  }).profileId;
}
