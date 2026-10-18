// 기준일 숫자 규칙 (결정 2026-10-18 · B) — 실제 소재 ig-ax-supporters-ot 모양
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { env } from '../config.ts';
import { datedNumberIssues, datedNumbers, hasDate } from './dated.ts';

const AX = fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/sources/ig-ax-supporters-ot.md'), 'utf8');

describe('원문에서 숫자 ↔ 기준일 묶음 찾기', () => {
  it('「(10월 1일 기준)」 줄의 1,015 · 2,535 · 966 (그리고 같은 줄의 7)을 10월 1일에 묶는다', () => {
    const m = datedNumbers(AX);
    expect([...m.keys()].sort()).toEqual(['1015', '2535', '7', '966'].sort());
    expect(m.get('1015')).toMatchObject({ month: 10, day: 1 });
  });
  it('날짜 숫자 자체(2026.10.01 · 2026.07.22)는 묶지 않는다, 날짜 없는 「현황판 기준」은 기준일이 아니다', () => {
    const m = datedNumbers('출처 ・ 보도자료(2026.07.22) · 현황판(2026.10.01 기준)\n현황판 기준 프로젝트 12개');
    expect([...m.keys()]).toEqual([]);
  });
  it('기준일이 다른 줄에 있으면 못 묶는다 (알려진 한계)', () => {
    expect([...datedNumbers('10월 1일 기준 현황\n프로젝트 1,015개').keys()]).toEqual([]);
  });
});

describe('기준일 표기 찾기', () => {
  it('「10월 1일」·「2026.10.01」·「10/1」 모두 같은 날', () => {
    const d = { month: 10, day: 1, text: '10월 1일' };
    expect(hasDate('10월 1일 기준 숫자예요', d)).toBe(true);
    expect(hasDate('현황판(2026.10.01)', d)).toBe(true);
    expect(hasDate('10/1 기준', d)).toBe(true);
    expect(hasDate('10월 11일', d)).toBe(false);
  });
});

describe('세트 안 한 곳 이상에 기준일', () => {
  const dated = datedNumbers(AX);
  it('숫자를 쓴 카드 중 한 곳이라도 기준일이 있으면 통과, 아무 데도 없으면 그 숫자가 처음 나온 곳을 짚는다', () => {
    expect(datedNumberIssues([{ where: 'cards.2', text: '10월 1일 기준 현황판 숫자예요. 프로젝트 1,015개' }, { where: 'cards.5', text: '1,015개 중에서 고르기' }], dated)).toEqual([]);
    const bad = datedNumberIssues([{ where: 'cards.2', text: '프로젝트 1,015개 · 개발자 2,535명' }], dated);
    expect(bad.map((b) => `${b.where}:${b.number}`).sort()).toEqual(['cards.2:1015', 'cards.2:2535']);
  });
  it('본문이 이미 지키는 숫자는 캡션에서 다시 보지 않는다(skip)', () => {
    expect(datedNumberIssues([{ where: 'lines.0', text: '프로젝트 1,015개' }], dated, new Set(['1015']))).toEqual([]);
  });
});
