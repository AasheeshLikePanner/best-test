import { SchedulerState, IntentSchema, TimeSlot } from '../types';
import { parseCalendar } from '../parser/calendarParser';
import { computeFreeSlots, rankSlots } from '../scheduling/slotFinder';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { toDate, formatInTimeZone } from 'date-fns-tz';
import { format, parse, isValid } from 'date-fns';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

export async function loadCalendarNode(state: SchedulerState): Promise<Partial<SchedulerState>> {
    console.log('--- loadCalendarNode ---');
    const calendarPath = 'calendar.txt';
    try {
        const content = await fs.readFile(calendarPath, 'utf-8');
        const fileHash = crypto.createHash('sha256').update(content).digest('hex');

        if (state.calendarMeta?.fileHash === fileHash) {
            return {};
        }

        console.log(`Calendar file hash: ${fileHash.slice(0, 8)}`);

        const parsed = parseCalendar(content, state.referenceDate);
        return {
            calendarMeta: {
                weekStart: parsed.weekStart,
                workingHours: parsed.workingHours,
                timezone: parsed.timezone,
                dayLabels: parsed.dayLabels,
                fileHash,
            },
            events: parsed.events,
        };
    } catch (err: any) {
        return {
            error: { message: `Failed to load calendar: ${err.message}`, code: 'LOAD_FAILED', timestamp: new Date().toISOString() },
            phase: 'error'
        };
    }
}

import { ReferenceDateManager } from '../utils/referenceDate';
import { loadConfig } from '../config/scheduler.config';
import { Logger } from '../utils/logger'; // Assuming Logger is from a utility file
import { resolveTargetDate, validateResolvedDate } from '../utils/dateResolver';
import { validateIntent } from '../validators/intentValidator';

const config = loadConfig();
const logger = new Logger('nodes');

export async function extractIntentNode(state: SchedulerState): Promise<Partial<SchedulerState>> {
    const lastMessage = state.messages[state.messages.length - 1];
    const llm = new ChatAnthropic({
        model: config.llm.model,
        apiKey: process.env.ANTHROPIC_API_KEY,
        temperature: config.llm.temperature
    });

    if (state.calendarMeta === null) {
        logger.error("No calendar loaded in state.");
        return { phase: 'error', error: { message: "No calendar loaded.", code: "NO_CALENDAR", timestamp: new Date().toISOString() } };
    }

    const structured = llm.withStructuredOutput(IntentSchema);

    const daySummary = state.calendarMeta ? Object.entries(state.calendarMeta.dayLabels || {}).map(([date, label]) => {
        const count = state.events.filter(e => e.date === date).length;
        return `${label}=${date} (${count} events)`;
    }).join(', ') : 'None';

    const dateManager = ReferenceDateManager.getInstance();
    const today = dateManager.getDate();
    const todayStr = dateManager.getDateString();

    logger.debug('Intent extraction (pure)', { todayStr, query: lastMessage.content });

    const prompt = `
You are a precision natural language parser. 
Parse the user's scheduling request into semantic tokens.

[CONTEXT]
- Today is: ${today.toLocaleDateString('en-US', { weekday: 'long' })}
- Calendar Scope: ${state.calendarMeta?.weekStart}
- Available Days in file: ${daySummary}

[INPUT]
User Request: "${lastMessage.content}"

[RULES]
1. WHAT DAY (timeConstraint):
   - Extract verbatim (e.g. "Monday", "tomorrow"). 
   - Mapping "type":
     * Day names ("Monday", "Tuesday", etc) -> type: "DAY_OF_WEEK"
     * "today", "tomorrow" -> type: "RELATIVE"
     * Specific dates ("Jan 15", "2026-01-20") -> type: "ABSOLUTE"
   - Output ONLY the verbatim string as "value".
   - If they specify "morning" or "afternoon", put it in "timeOfDay".
2. WHO (participants):
   - Extract ALL names mentioned (e.g. "Jordan", "Sarah"). 
   - "with Jordan or Sarah" -> participants: ["Jordan", "Sarah"], participantMode: "any_of"
   - Default participantMode is "all_of".
3. SPECIFIC TIME:
   - If mentioned (e.g. "at 3 PM UTC"), extract:
     * specificTime: "3:00 PM"
     * timezone: "UTC"
   - If no timezone mentioned but specific time is, leave timezone null.
4. HOW LONG (durationMin):
   - Extract number and convert to minutes. Default 30.

Return ONLY JSON.
`;

    try {
        const rawIntent = await structured.invoke(prompt);
        const intent = validateIntent(rawIntent);
        return { intent, phase: 'extracted', error: null };
    } catch (err: any) {
        logger.error('Extraction failed', { error: err.message });
        return { phase: 'error', error: { message: err.message, code: 'EXTRACT_FAILED', timestamp: new Date().toISOString() } };
    }
}

export async function resolveIntentNode(state: SchedulerState): Promise<Partial<SchedulerState>> {
    if (!state.intent) return { phase: 'error' };

    const dateManager = ReferenceDateManager.getInstance();
    const referenceDate = dateManager.getDate();

    try {
        const resolvedDate = resolveTargetDate(state.intent.timeConstraint, referenceDate);

        // Validation: Does it match what the user expected?
        const isValid = validateResolvedDate(resolvedDate, state.intent.timeConstraint);

        if (!isValid) {
            throw new Error(`Resolved date ${resolvedDate} does not match semantic intent ${state.intent.timeConstraint.value}`);
        }

        return { resolvedDate, phase: 'resolved' }; // Continue to finding slots
    } catch (err: any) {
        logger.error('Resolution failed', { error: err.message });
        return { phase: 'error', error: { message: err.message, code: 'RESOLVE_FAILED', timestamp: new Date().toISOString() } };
    }
}

export async function findSlotsNode(state: SchedulerState): Promise<Partial<SchedulerState>> {
    if (!state.intent || !state.calendarMeta || !state.resolvedDate) {
        return { phase: 'error' };
    }

    const { intent, events, calendarMeta, resolvedDate } = state;
    const dayEvents = events.filter(e => e.date === resolvedDate);

    let freeSlots = computeFreeSlots(
        calendarMeta.workingHours,
        dayEvents,
        intent.durationMin,
        resolvedDate,
        intent.specificTime ? 'any' : intent.timeOfDay
    );

    if (freeSlots.length === 0) {
        return {
            error: { message: `No slots available on ${resolvedDate}.`, code: 'NO_SLOTS', timestamp: new Date().toISOString() },
            phase: 'error'
        };
    }

    // Bias to time mentioned in raw request
    let biasTime: number | null = null;
    let preferredTimeWarning: string | null = null;

    if (intent.specificTime) {
        try {
            const timeStr = intent.specificTime;
            const tz = intent.timezone || 'America/New_York';
            const isoLikeStr = `${resolvedDate}T${convertto24h(timeStr)}`;

            const zonedDate = toDate(isoLikeStr, { timeZone: tz });
            if (!isValid(zonedDate)) throw new Error("Resulting zoned date is invalid");

            const localTimeStr = formatInTimeZone(zonedDate, 'America/New_York', 'HH:mm');
            const [h, m] = localTimeStr.split(':').map(Number);
            biasTime = h * 60 + m;

            if (biasTime < dayStart || biasTime > dayEnd) {
                preferredTimeWarning = `I notice you requested ${timeStr}${intent.timezone ? ` ${intent.timezone}` : ''} (which is ${formatMinutes(biasTime)} local time), but this falls outside our typical working hours (${formatMinutes(dayStart)} - ${formatMinutes(dayEnd)}).`;
            }
        } catch (err: any) {
            logger.error('Timezone conversion failed', { message: err.message, specificTime: intent.specificTime });
        }
    }

    if (biasTime === null) {
        const timeMatch = intent.rawRequest.match(/(\d{1,2})\s*(AM|PM)/i);
        if (timeMatch) {
            let h = parseInt(timeMatch[1]);
            if (timeMatch[2].toUpperCase() === 'PM' && h !== 12) h += 12;
            if (timeMatch[2].toUpperCase() === 'AM' && h === 12) h = 0;
            biasTime = h * 60;
        }
    }

    // Sort by distance to biasTime if present, otherwise chronological
    freeSlots.sort((a, b) => {
        if (biasTime !== null) {
            const distA = Math.abs(a.startMin - biasTime);
            const distB = Math.abs(b.startMin - biasTime);
            return distA - distB; // Strictly closest first
        }
        return a.startMin - b.startMin;
    });

    const diverse = freeSlots.slice(0, 5);
    return { proposals: diverse, phase: 'proposed', biasTimeMin: biasTime, preferredTimeWarning };
}

function convertto24h(timeStr: string): string {
    const timeMatch = timeStr.match(/(\d{1,2}):?(\d{0,2})\s*(AM|PM)/i);
    if (!timeMatch) return "12:00:00";
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = (timeMatch[3] || '').toUpperCase();
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
}

function formatMinutes(min: number): string {
    let h = Math.floor(min / 60);
    const m = min % 60;
    const meridiem = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${meridiem}`;
}

export async function proposeSlotsNode(state: SchedulerState): Promise<Partial<SchedulerState>> {
    if (!state.proposals || !state.intent || !state.resolvedDate) return { phase: 'error' };

    const llm = new ChatAnthropic({
        model: config.llm.model,
        apiKey: process.env.ANTHROPIC_API_KEY,
        temperature: config.llm.temperature
    });

    const slotList = state.proposals
        .map((slot, idx) => `${idx + 1}. ${slot.displayStart} - ${slot.displayEnd}`)
        .join('\n');

    const participants = state.intent.participants.length > 0
        ? state.intent.participants.join(state.intent.participantMode === 'any_of' ? ' or ' : ' and ')
        : 'us';

    const biasText = state.biasTimeMin !== null ? ` (which is ${formatMinutes(state.biasTimeMin)} local time)` : "";
    const warningText = state.preferredTimeWarning ? `${state.preferredTimeWarning}\n\nHere are some alternative slots closest to your request:\n` : "";

    const prompt = `
Structure a friendly response proposing these slots for a ${state.intent.durationMin} min meeting with ${participants} on ${state.resolvedDate}.
If the user requested a specific time, acknowledge it and its local conversion: ${state.intent.specificTime}${biasText}.

${warningText}
${slotList}

Which option works for you?
Include the participants' names in the proposal.
`;

    const response = await llm.invoke([{ role: 'user', content: prompt }]);
    return { messages: [new AIMessage(response.content as string)] };
}

export async function handleSelectionNode(state: SchedulerState): Promise<Partial<SchedulerState>> {
    const lastMessage = state.messages[state.messages.length - 1];
    const userResponse = (lastMessage.content as string).toLowerCase();

    const optionMatch = userResponse.match(/option\s*(\d+)|^(\d+)$/);
    if (optionMatch && state.proposals) {
        const idx = parseInt(optionMatch[1] || optionMatch[2]) - 1;
        if (idx >= 0 && idx < state.proposals.length) {
            return {
                confirmed: { slotIndex: idx, slot: state.proposals[idx], timestamp: new Date().toISOString() },
                phase: 'confirmed'
            };
        }
    }

    return { phase: 'rejected' };
}

export async function confirmMeetingNode(state: SchedulerState): Promise<Partial<SchedulerState>> {
    const { confirmed, intent } = state;
    if (!confirmed) return { phase: 'error' };

    const msg = `Great! I've noted your preference:
${intent?.participants.length ? 'Meeting with ' + intent.participants.join(', ') : 'Meeting'}
${confirmed.slot.date}, ${confirmed.slot.displayStart} - ${confirmed.slot.displayEnd}`;

    return { messages: [new AIMessage(msg)] };
}

export async function handleRejectionNode(state: SchedulerState): Promise<Partial<SchedulerState>> {
    return {
        messages: [new AIMessage("I understand. Would you like to try a different day or duration?")],
        proposals: null,
        phase: 'initial'
    };
}

export async function handleErrorNode(state: SchedulerState): Promise<Partial<SchedulerState>> {
    const msg = state.error?.message || "Something went wrong.";
    return { messages: [new AIMessage(`Error: ${msg}`)] };
}
