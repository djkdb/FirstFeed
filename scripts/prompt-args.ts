// 측정 스크립트의 `--prompt 이름=vN` 읽기 — 다섯 스크립트가 같은 코드를 복사해 쓰던 것을 한 곳으로.
// 예전 코드는 모양이 맞지 않는 인자를 조용히 건너뛰었다. zsh 에서 `P="--prompt a=v3 --prompt b=v4"; … $P` 는
// 단어로 쪼개지지 않고 인자 하나로 넘어가, 측정 전체가 활성 판(옛 판)으로 돌았는데 아무 경고가 없었다(2026-10-20 카드 측정).
// 그래서 잘못된 모양이면 측정을 시작하기 전에 멈춘다.
import fs from 'node:fs';
import path from 'node:path';

const PAIR = /^([a-z][a-z0-9_]*)=(v\d+)$/;

/** `--prompt 이름=vN` 들을 읽는다. 모양이 틀리거나 프롬프트 파일이 없으면 이유를 담아 던진다 */
export function parsePromptArgs(args: readonly string[], promptsDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  args.forEach((a, i) => {
    if (a.startsWith('--prompt') && a !== '--prompt') {
      throw new Error(`인자 「${a}」를 읽을 수 없습니다. 「--prompt 이름=vN」을 판마다 따로 넘기세요(셸 변수에 담았다면 따옴표 없이 펼쳐도 zsh 는 쪼개지 않습니다 — 배열을 쓰세요)`);
    }
    if (a !== '--prompt') return;
    const m = PAIR.exec(args[i + 1] ?? '');
    if (!m) throw new Error(`「--prompt」 다음 값 「${args[i + 1] ?? '(없음)'}」이 「이름=vN」 모양이 아닙니다. 예: --prompt card_body=v3`);
    const [, name, ver] = m as unknown as [string, string, string];
    if (!fs.existsSync(path.join(promptsDir, name, `${ver}.md`))) throw new Error(`프롬프트 파일 prompts/${name}/${ver}.md 가 없습니다. 이름과 판을 확인하세요`);
    out[name] = ver;
  });
  return out;
}
