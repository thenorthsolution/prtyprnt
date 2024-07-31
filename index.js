import kleur from 'kleur';
import { logger, LoggerWriteStreamMode, Utils } from './dist/index.js';

await logger.createFileWriteStream({
    path: './logs/latest.log',
    mode: LoggerWriteStreamMode.Rename,
    renameFile: Utils.brotliCompressLog
});

logger.label = 'Example';
logger.debugmode = {
    printMessage: true,
}

logger.fatal(kleur.yellow(new Error('Hello world!').stack));
logger.error('Hello world!');
logger.warn('Hello world!');
logger.debug('Hello world!');
logger.info('Hello world!');