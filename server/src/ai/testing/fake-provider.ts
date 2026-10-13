// 테스트용 가짜 공급자. 실제 CLI 없이 깨진 JSON·규칙 위반·지연·취소를 그대로 재현해 루프를 반복 시험한다.
import { AiError, type AiProvider, type ProviderRunInput, type ProviderRunOutput, type ProviderStatus } from '../types.ts';

export type FakeStep =
  | { structured: unknown }
  | { text: string }
  | { error: AiError }
  /** 취소될 때까지(또는 ms 동안) 기다린 뒤 structured 를 돌려준다 */
  | { waitMs: number; structured: unknown };

export class FakeProvider implements AiProvider {
  readonly id = 'fake';
  readonly calls: ProviderRunInput[] = [];
  running = 0;
  maxRunning = 0;
  private i = 0;
  constructor(private readonly steps: FakeStep[]) {}

  async detect(): Promise<ProviderStatus> {
    return { id: 'fake', name: 'Fake', installed: true, version: '0', loggedIn: true, authMethod: null, subscription: null, supported: true, hint: null };
  }

  async run(input: ProviderRunInput): Promise<ProviderRunOutput> {
    this.calls.push(input);
    const step = this.steps[this.i++];
    if (!step) throw new Error(`가짜 공급자에 준비된 응답이 없습니다 (${this.i}번째 호출)`);
    this.running++;
    this.maxRunning = Math.max(this.maxRunning, this.running);
    try {
      if ('error' in step) throw step.error;
      if ('waitMs' in step) {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, step.waitMs);
          input.signal?.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new AiError('cancelled', 'AI 호출을 취소했습니다.', '필요하면 다시 실행하세요.'));
          });
        });
        return { structured: step.structured, text: '', model: input.model, durationMs: step.waitMs };
      }
      return 'structured' in step
        ? { structured: step.structured, text: '', model: input.model, durationMs: 1 }
        : { text: step.text, model: input.model, durationMs: 1 };
    } finally {
      this.running--;
    }
  }
}
