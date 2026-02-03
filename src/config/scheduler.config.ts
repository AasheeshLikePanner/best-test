export interface SchedulerConfig {
    workingHours: {
        start: number;  // e.g., 8.5 for 8:30 AM
        end: number;    // e.g., 18.0 for 6:00 PM
    };
    buffers: {
        interEventMinutes: number;
        minimumSlotMinutes: number;
    };
    calendar: {
        defaultPath: string;
    };
    llm: {
        model: string;
        temperature: number;
    };
}

export const DEFAULT_CONFIG: SchedulerConfig = {
    workingHours: { start: 8.5, end: 18.0 },
    buffers: { interEventMinutes: 5, minimumSlotMinutes: 15 },
    calendar: { defaultPath: './calendar.txt' },
    llm: { model: 'claude-3-haiku-20240307', temperature: 0 }
};

export function loadConfig(): SchedulerConfig {
    return {
        ...DEFAULT_CONFIG,
        // In the future, we could merge with process.env or a config.json file
    };
}
