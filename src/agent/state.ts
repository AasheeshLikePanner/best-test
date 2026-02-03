import { BaseMessage } from '@langchain/core/messages';
import { SchedulerState } from '../types';

export const stateChannels = {
    threadId: { value: (x: any, y: any) => y ?? x },
    messages: { value: (x: BaseMessage[], y?: BaseMessage[]) => (y ? [...x, ...y] : x), default: () => [] },
    calendarMeta: { value: (x: any, y: any) => y ?? x, default: () => null },
    events: { value: (x: any, y: any) => y ?? x, default: () => [] },
    intent: { value: (x: any, y: any) => y ?? x, default: () => null },
    proposals: { value: (x: any, y: any) => y ?? x, default: () => null },
    confirmed: { value: (x: any, y: any) => y ?? x, default: () => null },
    phase: { value: (x: string, y: string) => y ?? x, default: () => 'initial' },
    referenceDate: { value: (x: any, y: any) => y ?? x },
    resolvedDate: { value: (x: any, y: any) => y ?? x, default: () => null },
    biasTimeMin: { value: (x: any, y: any) => y ?? x, default: () => null },
    preferredTimeWarning: { value: (x: any, y: any) => y ?? x, default: () => null },
    error: { value: (x: any, y: any) => y ?? x, default: () => null },
};
