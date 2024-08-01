import EventEmitter from 'node:events';
import { Formatter } from './Formatter.js';
import { createWriteStream, WriteStream, type Stats } from 'node:fs';
import { FileWriteStreamMode, LogLevel } from '../types/constants.js';
import { type InspectOptions } from 'node:util';
import inspector from 'node:inspector';
import path from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import type { BaseFormatter, FormatterFormatOptions } from './BaseFormatter.js';
import type { Args, Key } from '../types/types.js';
import { Utils } from './Utils.js';

export interface LoggerWriteStreamOptions {
    path: string;
    mode: FileWriteStreamMode;
    renameFile?: (file: string, stat: Stats) => any;
    initialData?: string|((file: string) => string|Promise<string>);
}

export interface LoggerOptions {
    formatter?: BaseFormatter;
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
    [event in LogLevel]: [data: FormatterFormatOptions & { pretty: string; simple: string; }];
};

export class Logger extends EventEmitter<LoggerEvents> implements LoggerOptions {
    public formatter: BaseFormatter;
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

        this.formatter = options?.formatter ?? new Formatter(this);
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

        this.formatter.setLogger(this);
    }

    public fatal(...data: any[]): void {
        return this.print(LogLevel.Fatal, ...data);
    }

    public error(...data: any[]): void {
        return this.print(LogLevel.Error, ...data);
    }

    public warn(...data: any[]): void {
        return this.print(LogLevel.Warn, ...data);
    }

    public info(...data: any[]): void {
        return this.print(LogLevel.Info, ...data);
    }

    public debug(...data: any[]): void {
        return this.print(LogLevel.Debug, ...data);
    }

    public log(...data: any[]): void {
        return this.info(...data);
    }

    protected print(level: LogLevel, ...data: any[]): void {
        const options: FormatterFormatOptions = {
            level,
            messages: data
        };

        const pretty = this.formatter.formatConsoleLog(options);
        const simple = this.formatter.formatWriteStreamLog(options);

        this.emit(level, {
            ...options,
            pretty,
            simple
        });

        let writeToFile = true;

        switch (level) {
            case LogLevel.Fatal:
            case LogLevel.Error:
                console.error(pretty);
                break;
            case LogLevel.Warn:
                console.warn(pretty);
                break;
            case LogLevel.Info:
                console.info(pretty);
                break;
            case LogLevel.Debug:
                if (!this.isDebugging) break;

                if (this.debugmode?.printMessage !== false) {
                    console.debug(pretty);
                }

                writeToFile = this.debugmode?.writeToFile ?? true;
                break;
        }

        if (!this.isWriteStreamClosed && writeToFile) {
            this.writeStream?.write(`${simple}\n`, 'utf-8');
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

    public emit<K>(eventName: Key<K, LoggerEvents>, ...args: Args<K, LoggerEvents>): boolean {
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
        options.initialData ??= Utils.logDateHeader(new Date());

        const file = path.resolve(options.path);
        const filePathInfo = path.parse(file);
        const fileStat = await stat(file).catch(() => null);
        const initialData = (typeof options.initialData !== 'function'
            ? options.initialData ?? ''
            : await Promise.resolve(options.initialData(file))) + '\n';

        if (fileStat && !fileStat.isFile()) throw new Error('Write stream path is not a file');

        await mkdir(filePathInfo.dir, { recursive: true });

        switch (options.mode) {
            case FileWriteStreamMode.Append: break;
            case FileWriteStreamMode.Truncate:
                if (!fileStat) break;

                await writeFile(file, initialData, 'utf-8');
                break;
            case FileWriteStreamMode.Rename:
                if (!fileStat) break;

                if (options.renameFile) {
                    await Promise.resolve(options.renameFile(file, fileStat));
                } else {
                    await Utils.gzipCompressLog(file, fileStat);
                }

                const newStat = await stat(file).catch(() => null);
                if (!newStat) await writeFile(file, initialData, 'utf-8');
        }

        const writeStream = createWriteStream(file, {
            flags: options.mode === FileWriteStreamMode.Append ? 'a' : 'w',
            encoding: 'utf-8'
        });

        const content = await readFile(file, 'utf-8');
        if (options.initialData && !content) writeStream.write(initialData, 'utf-8');

        return writeStream;
    }
}