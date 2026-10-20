import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePromptArgs } from './prompt-args.ts';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-'));
for (const [n, v] of [['card_body', 'v3'], ['card_body_review', 'v4']] as const) {
  fs.mkdirSync(path.join(dir, n), { recursive: true });
  fs.writeFileSync(path.join(dir, n, `${v}.md`), '');
}

describe('측정 스크립트의 --prompt 읽기', () => {
  it('판마다 따로 넘긴 것을 읽는다', () => {
    expect(parsePromptArgs(['--set=real', '--prompt', 'card_body=v3', '--prompt', 'card_body_review=v4'], dir)).toEqual({ card_body: 'v3', card_body_review: 'v4' });
  });
  it('zsh 에서 한 덩어리로 넘어온 인자는 조용히 건너뛰지 않고 멈춘다 (2026-10-20 카드 측정이 옛 판으로 돈 원인)', () => {
    expect(() => parsePromptArgs(['--set=real', '--prompt card_body=v3 --prompt card_body_review=v4'], dir)).toThrow(/판마다 따로/);
  });
  it('모양이 틀린 값 · 없는 판은 멈춘다', () => {
    expect(() => parsePromptArgs(['--prompt', 'card_body'], dir)).toThrow(/이름=vN/);
    expect(() => parsePromptArgs(['--prompt'], dir)).toThrow(/이름=vN/);
    expect(() => parsePromptArgs(['--prompt', 'card_body=v9'], dir)).toThrow(/v9\.md 가 없습니다/);
  });
});
