import { TimeSlot, Intent } from '../types';
import { mergeIntervals, Interval } from './intervals';

export function computeFreeSlots(
    workingHours: [number, number],
    events: Array<{ startMin: number; endMin: number; title: string }>,
    durationMin: number,
    targetDate: string,
    timeframe?: 'morning' | 'afternoon' | 'evening' | 'any'
): TimeSlot[] {
    const [dayStart, dayEnd] = workingHours;
    const BUFFER = 5;

    // 1. Filter and sort
    const validEvents = events
        .filter(e => e.endMin > e.startMin)
        .sort((a, b) => a.startMin - b.startMin);

    // 2. Build occupied intervals with buffer ONLY between consecutive events
    const occupied: Interval[] = [];
    for (let i = 0; i < validEvents.length; i++) {
        const event = validEvents[i];
        const nextEvent = validEvents[i + 1];

        let end = event.endMin;
        if (nextEvent && (nextEvent.startMin - event.endMin < BUFFER * 2)) {
            end += BUFFER;
        }
        occupied.push({ start: event.startMin, end });
    }
    const merged = mergeIntervals(occupied);

    console.log(`Events for ${targetDate}:`);
    validEvents.forEach(e => console.log(`  ${formatMinutes(e.startMin)} - ${formatMinutes(e.endMin)}: ${e.title}`));

    console.log('Merged occupied intervals:');
    merged.forEach(m => console.log(`  ${formatMinutes(m.start)} - ${formatMinutes(m.end)}`));

    // 3. Find gaps >= durationMin
    const gaps: Interval[] = [];
    let cursor = dayStart;
    for (const e of merged) {
        if (cursor < e.start) {
            if (e.start - cursor >= durationMin) {
                gaps.push({ start: cursor, end: e.start });
            }
        }
        cursor = Math.max(cursor, e.end);
    }
    if (cursor < dayEnd && dayEnd - cursor >= durationMin) {
        gaps.push({ start: cursor, end: dayEnd });
    }

    console.log(`Free intervals for ${targetDate}:`);
    gaps.forEach(g => {
        const startH = Math.floor(g.start / 60).toString().padStart(2, '0');
        const startM = (g.start % 60).toString().padStart(2, '0');
        const endH = Math.floor(g.end / 60).toString().padStart(2, '0');
        const endM = (g.end % 60).toString().padStart(2, '0');
        console.log(`  ${startH}:${startM} - ${endH}:${endM}`);
    });

    // 4. Apply timeframe filter and discretize
    const ranges = {
        morning: [0, 720],
        afternoon: [720, 1020],
        evening: [1020, 1440],
        any: [0, 1440]
    };
    const [tfStart, tfEnd] = ranges[timeframe || 'any'];

    const slots: TimeSlot[] = [];
    for (const gap of gaps) {
        let start = Math.max(gap.start, tfStart);
        let end = Math.min(gap.end, tfEnd);

        if (end - start < durationMin) continue;

        const increment = durationMin <= 30 ? 15 : 30;
        let slotStart = start % 5 === 0 ? start : Math.ceil(start / 5) * 5;

        while (slotStart + durationMin <= end) {
            slots.push({
                date: targetDate,
                startMin: slotStart,
                endMin: slotStart + durationMin,
                displayStart: formatMinutes(slotStart),
                displayEnd: formatMinutes(slotStart + durationMin),
            });
            slotStart += increment;
            if (slots.length >= 20) break;
        }
        if (slots.length >= 20) break;
    }

    return slots;
}

export function rankSlots(slots: TimeSlot[]): TimeSlot[] {
    return slots.sort((a, b) => a.startMin - b.startMin);
}

function formatMinutes(min: number): string {
    let h = Math.floor(min / 60);
    const m = min % 60;
    const meridiem = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${meridiem}`;
}
