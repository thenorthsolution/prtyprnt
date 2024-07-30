import { formatWithOptions } from 'util';
import { BaseFormatter, type FormatterFormatOptions } from './BaseFormatter.js';
import type { Logger } from './Logger.js';

export class Formatter extends BaseFormatter {
    constructor(logger?: Logger) {
        super(logger);
    }

    public format(options: FormatterFormatOptions): string {
        return this.logger?.formatter?.format(options) ?? '';
    }

    public stringify(message: any, ...optionalParams: any[]): string {
        return formatWithOptions(this.logger?.objectInspectOptions ?? {}, message, ...optionalParams);
    }
}