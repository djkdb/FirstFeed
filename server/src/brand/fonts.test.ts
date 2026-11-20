// 폰트 목록이 실제로 설치된 파일·라이선스와 맞는지 (목록만 고치고 파일을 빠뜨리는 일이 없게)
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { env } from '../config.ts';
import { FONTS } from './fonts.ts';

describe('폰트 목록 (FR-BR-3)', () => {
  it('19종(2026-11-19 검은고딕 + 7종, 2026-11-20 카페24 2종 · 나눔스퀘어), id 가 겹치지 않고 모두 OFL 1.1', () => {
    expect(FONTS).toHaveLength(19);
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(19);
    expect(FONTS.every((f) => f.license.name === 'SIL OFL 1.1')).toBe(true);
  });

  it('제목 3안·본문 3안을 만들 만큼 쓰임이 있다', () => {
    expect(FONTS.filter((f) => f.roles.includes('title')).length).toBeGreaterThanOrEqual(3);
    expect(FONTS.filter((f) => f.roles.includes('body')).length).toBeGreaterThanOrEqual(3);
  });

  it.each(FONTS.map((f) => [f.id, f] as const))('%s: 라이선스 파일이 실제로 있고 OFL 1.1 이며, 적힌 저작권·예약 이름과 맞다', (_id, f) => {
    const file =
      f.source.kind === 'npm'
        ? path.join(env.repoRoot, 'node_modules', f.source.package, f.source.licenseFile)
        : path.join(env.repoRoot, 'app/public/fonts', f.id, 'OFL.txt'); // repo · site: 레포에 넣은 폴더
    const text = fs.readFileSync(file, 'utf8');
    expect(text).toMatch(/SIL Open Font License, Version 1\.1/);
    expect(text).toContain(f.license.copyright.replace(/\.$/, ''));
    // 예약 이름은 「Reserved Font Name Pretendard」 또는 「Reserved Font Name <Gmarket Sans Font>」 모양
    if (f.license.reservedFontName) expect(text.replace(/[<>]/g, '')).toContain(`Reserved Font Name ${f.license.reservedFontName}`);
    else expect(text).not.toMatch(/with Reserved Font Name/);
  });

  it('공식 사이트에서 받은 글꼴은 레포의 파일이 받은 묶음 그대로다(sha256 — 고치지 않음, 예약 이름 · 판 기록)', () => {
    for (const f of FONTS) {
      if (f.source.kind !== 'site') continue;
      const dir = path.join(env.repoRoot, 'app/public/fonts', f.id);
      const fontFiles = fs.readdirSync(dir).filter((x) => /\.(ttf|otf|woff2?)$/.test(x));
      expect(fontFiles.sort(), f.id).toEqual(Object.keys(f.source.files).sort());
      for (const [name, sum] of Object.entries(f.source.files)) expect(createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex'), `${f.id}/${name}`).toBe(sum);
    }
  });

  it('npm 패키지는 package.json 에 정확한 버전으로 고정돼 있다 — 같은 입력이면 같은 렌더링 (PRD 9장 일관성)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'app/package.json'), 'utf8')) as { dependencies: Record<string, string> };
    for (const f of FONTS) if (f.source.kind === 'npm') expect(pkg.dependencies[f.source.package], f.id).toBe(f.source.version);
  });
});
