// 업로드 폴더 만들기 (FR-PB-1 · 결정 2026-10-18). 수용 기준: 업로드 창에서 전체 선택하면 순서가 맞는다.
// <업로드 루트>/<날짜>_<표지 제목>/업로드/01.png … + 캡션.txt · 그림-프롬프트.txt · 확인한-설명.txt
// - 올릴 그림만 업로드/ 에 — 전체 선택에 글 파일이 섞이지 않게
// - 이름은 두 자리 번호(이름순 = 카드 순서), 수정 시각도 카드 순서대로 1초씩(휴대폰 사진 앱은 날짜순)
// - 같은 이름 폴더가 있으면 덮어쓰지 않고 -2, -3 … · 서버는 업로드 루트 밖에 쓰지 않는다
// - 표시된 풀이 문장(카드·캡션)을 모두 확인하기 전엔 만들지 않는다
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { uncheckedGlosses } from '../cards/gloss-check.ts';
import { getSet, rendersDir } from '../cards/store.ts';
import { addExport, captionText, getCaption, getExport } from './store.ts';

export class ExportError extends Error {}

/** 설정의 업로드 루트(「~」 는 홈 폴더)를 절대 경로로 */
export function uploadRoot(db: Db): string {
  const raw = getSetting(db, 'publish.uploadRoot').trim();
  const p = raw === '~' || raw.startsWith('~/') ? path.join(os.homedir(), raw.slice(1)) : raw;
  if (!path.isAbsolute(p)) throw new ExportError(`업로드 폴더 위치 "${raw}" 가 절대 경로가 아닙니다. 「~/Downloads/FirstFeed」 처럼 적어 주세요.`);
  return path.normalize(p);
}

/** 폴더 이름에 쓸 수 있게: 강조·줄바꿈을 지우고, 운영체제가 못 쓰는 글자를 빼고, 공백은 하이픈 */
export function folderSlug(title: string): string {
  const s = title
    .replace(/\*\*/g, '')
    // 줄바꿈도 공백이라 먼저 하이픈으로 — 제어 문자를 먼저 지우면 「1.2」 와 「바뀐」 이 붙는다(테스트로 발견)
    .replace(/\s+/g, '-')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\p{Cc}/gu, '')
    .replace(/^[-.]+|[-.]+$/g, '');
  return [...s].slice(0, 40).join('') || '카드뉴스';
}

const localDate = () => new Date().toLocaleDateString('sv-SE');

/** 이름이 겹치면 -2, -3 … (덮어쓰지 않는다) */
function freeDir(root: string, name: string): string {
  let dir = path.join(root, name);
  for (let n = 2; fs.existsSync(dir); n++) dir = path.join(root, `${name}-${n}`);
  return dir;
}

export interface ExportResult {
  id: number;
  dir: string;
  files: string[];
}

export function exportSet(db: Db, dataDir: string, setId: number, now: Date = new Date()): ExportResult {
  const set = getSet(db, setId);
  if (!set) throw new ExportError('카드 세트를 찾지 못했습니다.');
  const caption = getCaption(db, setId);
  const unchecked = uncheckedGlosses(set).length + (caption?.glosses.filter((g) => !g.checkedAt).length ?? 0);
  if (unchecked > 0) throw new ExportError(`확인하지 않은 「소재에 없는 설명」이 ${unchecked}곳 있습니다. 모두 「확인했어요」를 누르거나 직접 고친 뒤 만들어 주세요.`);
  const root = uploadRoot(db);
  const cover = set.cards.find((c) => c.kind === 'cover');
  const title = cover && 'headline' in cover.content ? cover.content.headline : `세트-${setId}`;
  const dir = freeDir(root, `${localDate()}_${folderSlug(title)}`);
  // 업로드 루트 밖으로 나가는 이름이 없게(이름은 위에서 만들지만 한 번 더)
  if (path.relative(root, dir).startsWith('..')) throw new ExportError('업로드 폴더 위치 밖에는 만들 수 없습니다.');
  const up = path.join(dir, '업로드');
  fs.mkdirSync(up, { recursive: true });
  const files: string[] = [];
  const base = Math.floor(now.getTime() / 1000) - set.cards.length;
  for (const [i, c] of set.cards.entries()) {
    const name = `${String(i + 1).padStart(2, '0')}.png`;
    const to = path.join(up, name);
    fs.copyFileSync(path.join(rendersDir(dataDir, setId), c.pngFile), to);
    // 수정 시각을 카드 순서대로 1초씩 — 날짜순으로 보이는 곳(휴대폰 사진 앱 등)에서도 순서가 맞게
    fs.utimesSync(to, base + i, base + i);
    files.push(`업로드/${name}`);
  }
  if (caption) {
    fs.writeFileSync(path.join(dir, '캡션.txt'), `${captionText(caption)}\n`);
    files.push('캡션.txt');
  }
  const prompts = set.cards.filter((c) => c.image).map((c) => `${String(c.idx + 1).padStart(2, '0')}번 카드 · ${c.image!.filename}\n${c.image!.prompt}\n`);
  if (prompts.length) {
    fs.writeFileSync(path.join(dir, '그림-프롬프트.txt'), `# 카드 그림 프롬프트 — 그림 생성 도구에 붙여 넣어 만드세요\n\n${prompts.join('\n')}`);
    files.push('그림-프롬프트.txt');
  }
  const checked = [
    ...set.cards.flatMap((c) => (c.glosses ?? []).map((g) => `${String(c.idx + 1).padStart(2, '0')}번 카드 · 「${g.term}」 ${g.sentence} (확인 ${g.checkedAt})`)),
    ...(caption?.glosses ?? []).map((g) => `캡션 · 「${g.term}」 ${g.sentence} (확인 ${g.checkedAt})`),
  ];
  if (checked.length) {
    fs.writeFileSync(path.join(dir, '확인한-설명.txt'), `# 소재에 없는 설명 — 올리기 전에 사람이 확인한 문장\n\n${checked.join('\n')}\n`);
    files.push('확인한-설명.txt');
  }
  const id = addExport(db, setId, dir, files.length);
  return { id, dir, files };
}

/** 「폴더 열기」 — 이 앱이 만든(exports 에 적힌) 폴더만. 셸을 거치지 않고 인자로 넘긴다 */
export function openExport(db: Db, id: number): void {
  const e = getExport(db, id);
  if (!e) throw new ExportError('만든 폴더 기록을 찾지 못했습니다.');
  if (!fs.existsSync(e.path)) throw new ExportError(`폴더가 없습니다(옮기거나 지웠을 수 있어요): ${e.path}`);
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  spawn(cmd, [e.path], { detached: true, stdio: 'ignore' }).unref();
}
