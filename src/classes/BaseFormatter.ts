import type { Logger } from './Logger.js';
import type { LogLevel } from '../types/constants.js';

export interface FormatterFormatOptions {
    level: LogLevel;
    messages: any[];
}

export abstract class BaseFormatter {
    constructor(public readonly logger?: Logger) {}

    public abstract format(options: FormatterFormatOptions): string;
}