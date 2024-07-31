import type { Logger } from './Logger.js';
import type { LogLevel } from '../types/constants.js';

export interface FormatterFormatOptions {
    level: LogLevel;
    messages: any[];
}

export abstract class BaseFormatter {
    constructor(public logger?: Logger) {}

    public setLogger(logger: Logger) {
        this.logger = logger;
    }

    public abstract formatConsoleLog(options: FormatterFormatOptions): string;
    public abstract formatWriteStreamLog(options: FormatterFormatOptions): string;
}