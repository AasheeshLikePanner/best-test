export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 99
}

export class Logger {
    private level: LogLevel;
    private context: string;

    constructor(context: string, level: LogLevel = LogLevel.INFO) {
        this.context = context;
        this.level = level;
    }

    private format(level: string, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
        return `[${timestamp}][${level}][${this.context}] ${message}${dataStr}`;
    }

    debug(message: string, data?: any) {
        if (this.level <= LogLevel.DEBUG) {
            console.log(this.format('DEBUG', message, data));
        }
    }

    info(message: string, data?: any) {
        if (this.level <= LogLevel.INFO) {
            console.log(this.format('INFO', message, data));
        }
    }

    warn(message: string, data?: any) {
        if (this.level <= LogLevel.WARN) {
            console.warn(this.format('WARN', message, data));
        }
    }

    error(message: string, data?: any) {
        if (this.level <= LogLevel.ERROR) {
            console.error(this.format('ERROR', message, data));
        }
    }
}
