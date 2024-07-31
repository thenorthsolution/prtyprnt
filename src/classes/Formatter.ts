import { formatWithOptions, stripVTControlCharacters } from 'node:util';
import { BaseFormatter, type FormatterFormatOptions } from './BaseFormatter.js';
import type { Logger } from './Logger.js';
import kleur from 'kleur';
import { LogLevel } from '../types/constants.js';
import ansiRegex from 'ansi-regex';

export class Formatter extends BaseFormatter {
    public disabled: boolean = false;

    constructor(logger?: Logger) {
        super(logger);
    }

    public formatConsoleLog(options: FormatterFormatOptions): string {
        const string: string = this.stringify(...options.messages);
        const prefix: string = this.getConsoleLogPrefix(options.level);

        if (this.disabled) return string;

        const lines: string[] = string.split('\n');

        let lastAnsi: string|undefined = undefined;

        return this.appendPrefix(
                lines
                    .map((line, index) => {
                        const previousLine: string|undefined = lines[index - 1];
                        if (!previousLine) return line;

                        lastAnsi = previousLine.match(ansiRegex())?.pop() ?? lastAnsi;
                        return lastAnsi ? `${lastAnsi}${line}` : line;
                    })
                    .join('\n'),
                prefix
            );
    }

    public formatWriteStreamLog(options: FormatterFormatOptions): string {
        const string: string = this.stringify(...options.messages);
        const prefix: string = this.getWriteStreamLogPrefix(options.level);

        return stripVTControlCharacters(this.disabled ? string : this.appendPrefix(string, prefix));
    }

    public stringify(...data: any[]): string {
        return formatWithOptions(this.logger?.objectInspectOptions ?? { colors: kleur.enabled }, ...data);
    }

    public appendPrefix(string: string, prefix: string): string {
        const lines: string[] = [];

        for (const line of string.split('\n')) {
            lines.push(prefix + line);
        }

        return lines.join('\n');
    }

    public getConsoleLogPrefix(level: LogLevel): string {
        const date = new Date();
        const time = date.toLocaleTimeString(undefined, { hour12: false });

        let prefix: string;

        switch (level) {
            case LogLevel.Fatal:
            case LogLevel.Error:
                prefix = kleur.bgRed().bold().black(` ${level.toUpperCase()} `);
                break;
            case LogLevel.Warn:
                prefix = kleur.bgYellow().bold().black(` ${level.toUpperCase()} `);
                break;
            case LogLevel.Info:
                prefix = kleur.bgWhite().bold().black(` ${level.toUpperCase()} `);
                break;
            case LogLevel.Debug:
                prefix = kleur.bgMagenta().bold().white(` ${level.toUpperCase()} `);
                break;
        }

        prefix += kleur.bgBlack().gray(` ${time} `);

        return `${prefix}${kleur.gray(':')} `;
    }

    public getWriteStreamLogPrefix(level: LogLevel): string {
        const date = new Date();
        const time = date.toLocaleTimeString(undefined, { hour12: false });

        let prefix: string = `[${time}]`;

        if (this.logger?.label) {
            prefix += ` [${this.logger.label}/${level.toUpperCase()}]`;
        } else {
            prefix += ` [${level.toUpperCase()}]`;
        }

        return `${prefix}: `;
    }
}