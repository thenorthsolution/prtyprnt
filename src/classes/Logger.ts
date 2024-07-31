import EventEmitter from 'node:events';
import { Formatter } from './Formatter.js';
import { createWriteStream, WriteStream, type Stats } from 'node:fs';
import { LoggerWriteStreamMode, LogLevel } from '../types/constants.js';
import { stripVTControlCharacters, type InspectOptions } from 'node:util';
import inspector from 'node:inspector';
import path from 'node:path';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import type { FormatterFormatOptions } from './BaseFormatter.js';
import type { Args, Key } from '../types/types.js';

export interface LoggerWriteStreamOptions {
    path: string;
    mode: LoggerWriteStreamMode;
    renameFile?: (file: string, stat: Stats) => any;
}

export interface LoggerOptions {
    formatter?: Formatter;
    parent?: Logger;
    label?: string;
    debugmode?: {
        enabled?: boolean|(() => boolean);
        printMessage?: boolean;
        writeToFile?: boolean;
    };
    writeStream?: WriteStream;
    objectInspectOptions?: InspectOptions;
}

export type LoggerEvents = {
    [event in LogLevel]: [data: FormatterFormatOptions & { log: string; }];
};

export class Logger extends EventEmitter<LoggerEvents> implements LoggerOptions {
    public formatter: Formatter;
    public parent?: Logger;
    public label?: string;
    public debugmode?: LoggerOptions['debugmode'];
    public writeStream?: WriteStream;
    public objectInspectOptions?: InspectOptions;

    get isDebugging(): boolean {
        const explicitlyEnabled = typeof this.debugmode?.enabled === 'function' ? this.debugmode.enabled() : this.debugmode?.enabled;
        return explicitlyEnabled ?? (!!inspector.url() || /--debug|--inspect/g.test(process.execArgv.join('')));
    }

    get isWriteStreamClosed(): boolean {
        return !this.writeStream || this.writeStream.closed || this.writeStream.destroyed;
    }

    constructor(options?: LoggerOptions) {
        super();

        this.formatter = options?.formatter ?? new Formatter();
        this.parent = options?.parent;
        this.label = options?.label;
        this.debugmode = options?.debugmode ?? {};
        this.writeStream =options?.writeStream;
        this.objectInspectOptions = options?.objectInspectOptions;

        this.fatal = this.fatal.bind(this);
        this.error = this.error.bind(this);
        this.warn = this.warn.bind(this);
        this.info = this.info.bind(this);
        this.debug = this.debug.bind(this);
        this.log = this.log.bind(this);
    }

    public fatal(message: any, ...optionalParams: any[]): void {
        return this.print(LogLevel.Fatal, message, ...optionalParams);
    }

    public error(message: any, ...optionalParams: any[]): void {
        return this.print(LogLevel.Error, message, ...optionalParams);
    }

    public warn(message: any, ...optionalParams: any[]): void {
        return this.print(LogLevel.Warn, message, ...optionalParams);
    }

    public info(message: any, ...optionalParams: any[]): void {
        return this.print(LogLevel.Info, message, ...optionalParams);
    }

    public debug(message: any, ...optionalParams: any[]): void {
        return this.print(LogLevel.Debug, message, ...optionalParams);
    }

    public log(message: any, ...optionalParams: any[]): void {
        return this.info(message, ...optionalParams);
    }

    protected print(level: LogLevel, message: any, ...optionalParams: any[]): void {
        const options: FormatterFormatOptions = {
            level,
            messages: [message, ...optionalParams]
        };

        const formatted = this.formatter.format(options);

        this.emit(level, {
            ...options,
            log: formatted
        });

        let writeToFile = true;

        switch (level) {
            case LogLevel.Fatal:
            case LogLevel.Error:
                console.error(formatted);
                break;
            case LogLevel.Warn:
                console.warn(formatted);
                break;
            case LogLevel.Info:
                console.info(formatted);
                break;
            case LogLevel.Debug:
                if (this.debugmode?.printMessage) {
                    console.debug(formatted);
                }

                writeToFile = this.debugmode?.writeToFile ?? true;
                break;
        }

        if (!this.isWriteStreamClosed && writeToFile) {
            const stripped = stripVTControlCharacters(formatted);

            this.writeStream?.write(stripped + '\n', 'utf-8');
        }
    }

    public async createFileWriteStream(options: LoggerWriteStreamOptions): Promise<this> {
        if (!this.isWriteStreamClosed) {
            throw new Error('Write stream already created');
        }

        this.writeStream = await Logger.createFileWriteStream(options);
        return this;
    }

    public async closeFileWriteStream(): Promise<this> {
        await new Promise((resolve) => {
            if (!this.isWriteStreamClosed) {
                return resolve(this);
            }

            this.writeStream?.close(resolve);
        });

        return this;
    }

    public clone(options?: LoggerOptions, inheritParent: boolean = true): Logger {
        return new Logger({
            ...this.toJSON(),
            parent: inheritParent ? this.parent : this,
            ...options
        });
    }

    emit<K>(eventName: Key<K, LoggerEvents>, ...args: Args<K, LoggerEvents>): boolean {
        const result = super.emit<K>(eventName, ...args);
        if (this.parent) this.parent.emit(eventName, ...args);
        return result;
    }

    public toJSON(): LoggerOptions {
        return {
            formatter: this.formatter,
            parent: this.parent,
            label: this.label,
            debugmode: this.debugmode,
            writeStream: this.writeStream,
            objectInspectOptions: this.objectInspectOptions
        };
    }

    public static async createFileWriteStream(options: LoggerWriteStreamOptions): Promise<WriteStream> {
        const file = path.resolve(options.path);
        const filePathInfo = path.parse(file);
        const fileStat = await stat(file).catch(() => null);

        if (fileStat && !fileStat.isFile()) throw new Error('Write stream path is not a file');

        await mkdir(filePathInfo.dir, { recursive: true });

        switch (options.mode) {
            case LoggerWriteStreamMode.Append:
                break;
            case LoggerWriteStreamMode.Truncate:
                if (!fileStat) break;

                await writeFile(file, '');
                break;
            case LoggerWriteStreamMode.Rename:
                if (!fileStat) break;

                if (options.renameFile) {
                    await Promise.resolve(options.renameFile(file, fileStat));
                } else {
                    const newPath = path.join(filePathInfo.dir, `${filePathInfo.name}.old${filePathInfo.ext}`);

                    await rm(newPath, { force: true, recursive: true });
                    await rename(file, newPath);
                }
        }

        return createWriteStream(file, {
            flags: options.mode === LoggerWriteStreamMode.Append ? 'a' : 'w',
            encoding: 'utf-8'
        });
    }
}