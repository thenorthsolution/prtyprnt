import { formatWithOptions } from 'node:util';
import { BaseFormatter, type FormatterFormatOptions } from './BaseFormatter.js';
import type { Logger } from './Logger.js';
import kleur from 'kleur';

export class Formatter extends BaseFormatter {
    constructor(logger?: Logger) {
        super(logger);
    }

    public format(options: FormatterFormatOptions): string {
        return this.stringify(...options.messages);
    }

    public stringify(...data: any[]): string {
        return formatWithOptions(this.logger?.objectInspectOptions ?? { colors: kleur.enabled }, ...data);
    }
}