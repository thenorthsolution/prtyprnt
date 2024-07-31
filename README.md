# prtyprnt

A Node.js logging library

## Installation

```bash
npm install prtyprnt
```

## Usage

```js
// Default instance usage
import { logger } from 'prtyprnt';

logger.info('Hello, World!');
logger.debug('Hello, World!');
logger.warn('Hello, World!');
logger.error('Hello, World!');
logger.fatal('Hello, World!');
```

```js
// Custom instance usage
import { logger as defaultLogger, Logger, FileWriteStreamMode, Formatter } from 'prtyprnt';

const logger = new Logger({
    formatter: new Formatter(), // Formatter of log messages for console and write stream
    parent: defaultLogger, // Parent logger, events will also be emitted to this logger
    label: 'MyLogger', // Label of the logger
    debugmode: {
        enabled: true, // Enable debug mode
        printMessage: true, // Print debug messages to console
        writeToFile: true // Write debug messages to a file
    },
    writeStream: Logger.createFileWriteStream({
        mode: FileWriteStreamMode.Rename, // Mode when dealing with old log file
        filename: './logs/latest.log', // Filename of the log file
        renameFile: Utils.gzipCompressLog // Function to rename the log file
    }), // Write stream to log to a file
    objectInspectOptions: { colors: true } // Object inspect options
})

logger.info('Hello, World!');
logger.debug('Hello, World!');
logger.warn('Hello, World!');
logger.error('Hello, World!');
logger.fatal('Hello, World!');
```

```js
// Clone instance usage
const newLogger = logger.clone({
    label: 'MyNewLogger'
});

newLogger.info('Hello, World!');
newLogger.debug('Hello, World!');
newLogger.warn('Hello, World!');
newLogger.error('Hello, World!');
newLogger.fatal('Hello, World!');
```

```js
// Log to a file
import { logger, FileWriteStreamModem, Utils } from 'prtyprnt';

await logger.createFileWriteStream({
    mode: FileWriteStreamMode.Rename,
    filename: './logs/latest.log',
    renameFile: Utils.gzipCompressLog
});
```
