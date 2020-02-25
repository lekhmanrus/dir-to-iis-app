
import { argv } from 'optimist';

import { Watcher } from './watcher';
import { Logger } from './logger';
import { WatcherOptions } from './watcher-options';

Logger.info(`Run watcher with arguments: ${JSON.stringify(argv)}.`, 'run-watcher');
const watcher = new Watcher(argv as WatcherOptions);
watcher.run();
