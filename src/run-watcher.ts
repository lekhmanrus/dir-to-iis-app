#! /usr/bin/env node

import { argv } from 'optimist';
import { EventLogger } from 'node-windows';

import { Watcher } from './watcher';
import { WatcherOptions } from './watcher-options';

const logger = new EventLogger({ source: 'run-watcher' });
logger.info(`Run watcher with arguments: ${JSON.stringify(argv)}.`);
const watcher = new Watcher(argv as WatcherOptions);
watcher.run();
