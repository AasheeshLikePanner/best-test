import { BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';

// Zod schemas for validation
export const TimeSlotSchema = z.object({
    date: z.string(), // ISO: "2026-01-20"
    startMin: z.number(), // Minutes since midnight: 540 = 9:00 AM
    endMin: z.number(),
    displayStart: z.string(), // "9:00 AM"
    displayEnd: z.string(), // "10:00 AM"
});

export const TimeConstraintSchema = z.object({
    type: z.enum(['DAY_OF_WEEK', 'RELATIVE', 'ABSOLUTE']),
    value: z.string(), // "Monday", "tomorrow", "2026-01-20"
    modifier: z.enum(['this', 'next', 'coming', 'last']).nullable().optional(),
});

export const IntentSchema = z.object({
    durationMin: z.number().default(30),
    timeConstraint: TimeConstraintSchema,
    timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'any']).default('any'),
    participants: z.array(z.string()).default([]),
    participantMode: z.enum(['all_of', 'any_of', 'none']).default('all_of'),
    specificTime: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
    rawRequest: z.string(),
});

export type TimeSlot = z.infer<typeof TimeSlotSchema>;
export type Intent = z.infer<typeof IntentSchema>;
export type TimeConstraint = z.infer<typeof TimeConstraintSchema>;

// Main state interface
export interface SchedulerState {
    // Thread identity
    threadId: string;

    // Conversation history
    messages: BaseMessage[];

    // Calendar metadata (for change detection)
    calendarMeta: {
        weekStart: string; // ISO: "2026-01-20"
        workingHours: [number, number]; // [540, 1020] (9am-5pm in minutes)
        timezone: string; // "America/New_York"
        dayLabels: Record<string, string>; // ISO -> "Monday", etc.
        fileHash: string; // SHA-256 of calendar.txt content
    } | null;

    // Parsed calendar events (recomputed if hash changes)
    events: Array<{
        date: string; // ISO
        startMin: number;
        endMin: number;
        title: string;
    }>;

    // Extracted user intent (null until LLM processes)
    intent: Intent | null;

    // Proposed time slots (null until computed)
    proposals: Array<TimeSlot> | null;

    // User's confirmed choice
    confirmed: {
        slotIndex: number; // Index in proposals array
        slot: TimeSlot;
        timestamp: string; // ISO timestamp of confirmation
    } | null;

    // Current phase (for routing)
    phase?: 'initial' | 'extracted' | 'resolved' | 'proposed' | 'selected' | 'confirmed' | 'rejected' | 'error';

    // Reference date for relative parsing ("tomorrow", "next Monday")
    referenceDate: string; // ISO, defaults to today or env var

    // The actual resolved YYYY-MM-DD after deterministic calculation
    resolvedDate: string | null;

    // For anchor-based ranking
    biasTimeMin: number | null;
    preferredTimeWarning: string | null;

    // Error tracking
    error: {
        message: string;
        code: string;
        timestamp: string;
    } | null;
}
