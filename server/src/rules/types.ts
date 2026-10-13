// 규칙 검증·자기 평가가 찾은 문제 하나. error 는 재작성 사유, warn 은 보여 주기만 한다 (CLAUDE.md 5장).
export interface Issue {
  level: 'error' | 'warn';
  /** 문제 종류 (예: quote_not_in_source, number_not_in_source, review_fact) */
  code: string;
  message: string;
  /** 결과 안의 위치 (예: facts.1.quote) */
  where?: string;
  from: 'rule' | 'review';
}

export type Rule<T> = (data: T) => Issue[];
