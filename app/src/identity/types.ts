import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';

export type Current = InferResponseType<typeof api.api.identity.current.$get>;
export type State = NonNullable<Current['state']>;
export type Turn = State['turns'][number];
export type Profile = NonNullable<State['profile']>;
export type Question = InferResponseType<typeof api.api.identity.survey.$get>['questions'][number];
export type SurveyAnswers = Record<string, { choices: string[]; other?: string; text?: string }>;
