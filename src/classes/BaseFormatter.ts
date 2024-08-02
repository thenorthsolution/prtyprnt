import type { LogLevel } from '../types/constants.js';
import type { Logger } from './Logger.js';

export interface FormatterFormatOptions {
    level: LogLevel;
    messages: any[];
    logger: Logger;
}

export abstract class BaseFormatter {
    public abstract formatConsoleLog(options: FormatterFormatOptions): string;
    public abstract formatWriteStreamLog(options: FormatterFormatOptions): string;
}