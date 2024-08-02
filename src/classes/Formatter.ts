import { formatWithOptions, stripVTControlCharacters } from 'node:util';
import { BaseFormatter, type FormatterFormatOptions } from './BaseFormatter.js';
import kleur from 'kleur';
import { LogLevel } from '../types/constants.js';
import ansiRegex from 'ansi-regex';
import { Utils } from './Utils.js';
import type { Logger } from './Logger.js';

export class Formatter extends BaseFormatter {
    public disabled: boolean = false;

    public formatConsoleLog(options: FormatterFormatOptions): string {
        if (!Utils.supportsColor()) return this.formatWriteStreamLog(options);

        const string: string = this.stringify(options.logger, ...options.messages);
        const prefix: string = this.getConsoleLogPrefix(options.level, options.logger);

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
        const string: string = this.stringify(options.logger, ...options.messages);
        const prefix: string = this.getWriteStreamLogPrefix(options.level, options.logger);

        return stripVTControlCharacters(this.disabled ? string : this.appendPrefix(string, prefix));
    }

    public stringify(logger: Logger, ...data: any[]): string {
        return formatWithOptions(logger?.objectInspectOptions ?? { colors: Utils.supportsColor() }, ...data);
    }

    public appendPrefix(string: string, prefix: string): string {
        const lines: string[] = [];

        for (const line of string.split('\n')) {
            lines.push(prefix + line);
        }

        return lines.join('\n');
    }

    public getConsoleLogPrefix(level: LogLevel, logger: Logger): string {
        const date = new Date();
        const time = date.toLocaleTimeString(undefined, { hour12: false });

        let prefix: string = '';

        switch (level) {
            case LogLevel.Fatal:
            case LogLevel.Error:
                prefix += kleur.bgRed().bold().black(` ${level.toUpperCase()} `);

                if (logger?.label) {
                    prefix += kleur.bgBlack().red().dim(` ${logger.label} `);
                }

                break;
            case LogLevel.Warn:
                prefix += kleur.bgYellow().bold().black(` ${level.toUpperCase()}  `);

                if (logger?.label) {
                    prefix += kleur.bgBlack().yellow().dim(` ${logger.label} `);
                }

                break;
            case LogLevel.Info:
                prefix += kleur.bgCyan().bold().black(` ${level.toUpperCase()}  `);

                if (logger?.label) {
                    prefix += kleur.bgBlack().cyan().dim(` ${logger.label} `);
                }

                break;
            case LogLevel.Debug:
                prefix += kleur.bgMagenta().bold().white(` ${level.toUpperCase()} `);

                if (logger?.label) {
                    prefix += kleur.bgBlack().magenta().dim(` ${logger.label}`);
                }

                break;
        }

        prefix += kleur.gray(` ${time} `);

        return `${prefix}${kleur.gray(':')} `;
    }

    public getWriteStreamLogPrefix(level: LogLevel, logger: Logger): string {
        const date = new Date();
        const time = date.toLocaleTimeString(undefined, { hour12: false });

        let prefix: string = `[${time}]`;

        if (logger?.label) {
            prefix += ` [${logger.label}/${level.toUpperCase()}]`;
        } else {
            prefix += ` [${level.toUpperCase()}]`;
        }

        return `${prefix}: `;
    }
}