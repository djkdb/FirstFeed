// prompts/<이름>/<버전>.md 를 읽어 {{변수}} 를 채운다. 프롬프트 문장은 코드에 두지 않는다 (CLAUDE.md 5장).
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';

export interface LoadedPrompt {
  text: string;
  ref: { name: string; version: string };
}

const META_COMMENT = /^\s*<!--[\s\S]*?-->\s*/;

/** 활성 버전은 설정 'prompts.activeVersions' 에서 고른다 (없으면 v1) — 버전 비교 평가 때 설정만 바꿔 돌리려고 */
export function loadPrompt(db: Db | null, name: string, vars: Record<string, string>, version?: string): LoadedPrompt {
  const ver = version ?? getSetting(db, 'prompts.activeVersions')[name] ?? 'v1';
  const file = path.join(env.promptsDir, name, `${ver}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(`프롬프트 파일이 없습니다: prompts/${name}/${ver}.md. 파일을 만들거나 설정의 활성 버전을 확인하세요.`);
  }
  // 맨 앞 HTML 주석은 사람을 위한 메모(목적·쓰는 곳)라 AI 에 보내지 않는다
  const template = fs.readFileSync(file, 'utf8').replace(META_COMMENT, '');
  const missing = new Set<string>();
  const text = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === undefined) missing.add(key);
    return v ?? '';
  });
  if (missing.size > 0) {
    throw new Error(`프롬프트 prompts/${name}/${ver}.md 에 채울 값이 없습니다: ${[...missing].join(', ')}. 호출하는 코드에서 값을 넘기세요.`);
  }
  const unused = Object.keys(vars).filter((k) => !template.includes(`{{${k}}}`));
  if (unused.length > 0) {
    throw new Error(`프롬프트 prompts/${name}/${ver}.md 에 없는 변수를 넘겼습니다: ${unused.join(', ')}. 변수 이름 오타가 아닌지 확인하세요.`);
  }
  return { text: text.trim(), ref: { name, version: ver } };
}
