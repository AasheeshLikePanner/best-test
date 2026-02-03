import { parseISO, format, addDays, getDay, startOfWeek } from 'date-fns';

/**
 * Resolves a weekday name (e.g., "Thursday") to a specific ISO date relative to an anchor.
 */
export function resolveWeekday(weekday: string, anchorDate: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDayNum = days.indexOf(weekday.toLowerCase());

    if (targetDayNum === -1) return format(anchorDate, 'yyyy-MM-dd');

    const anchorDayNum = getDay(anchorDate);
    let daysToAdd = targetDayNum - anchorDayNum;

    // RULE: If the target day is today or already passed this week, move to NEXT week.
    // Except if the user specifically meant "this Monday" while it's Monday morning? 
    // Usually "Monday" means "next Monday". For "Thursday" on Monday, it stays this week.
    if (daysToAdd <= 0) {
        daysToAdd += 7;
    }

    const resolvedDate = addDays(anchorDate, daysToAdd);
    return format(resolvedDate, 'yyyy-MM-dd');
}

/**
 * Validates if a date string is valid ISO YYYY-MM-DD.
 */
export function isValidISODate(dateStr: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}
