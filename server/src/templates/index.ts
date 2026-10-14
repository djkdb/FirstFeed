// 기본 틀 시안 목록 (FR-TP-1). 사용자가 하나를 골라 고정한다(FR-TP-3)
import { draftA } from './draft-a.ts';
import { draftB } from './draft-b.ts';
import { draftC } from './draft-c.ts';
import type { Draft } from './types.ts';

export const DRAFTS: Draft[] = [draftA, draftB, draftC];
export const draftById = (id: string): Draft | undefined => DRAFTS.find((d) => d.id === id);
