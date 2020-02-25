import { argv, showHelp, usage, options } from 'optimist';

import { DirToIisAppService } from './dir-to-iis-app-service';

setupCli();
const service = new DirToIisAppService(processAliases());

if (argv.h || argv.help) {
  help();
} else if (argv.uninstall) {
  service.uninstall();
} else {
  service.install();
}

function setupCli() {
  usage(`Usage: $0\n       $0 --uninstall`);
  options('name', {
    alias: 'n',
    describe: `Windows service name to install/uninstall (don't confuse with the display name.`,
    type: 'string'
  });
  options('site', {
    alias: [ 's', 'website', 'w' ],
    describe: `IIS website name. Name should match to the website at IIS.`,
    type: 'string'
  });
  options('paths', {
    alias: [ 'p', 'path' ],
    describe: `Paths to files, dirs to be watched recursively, or glob patterns.`,
    type: 'string'
  });
  options('startImmediately', {
    alias: [ 'i', 'immediately', 'start' ],
    describe: `Should the service get started immediately.`,
    type: 'boolean'
  });
}

function help() {
  showHelp();
}

function processAliases(): any {
  const opts: any = argv;

  if (!opts.name) {
    opts.name = opts.n;
    delete opts.n;
  }

  if (!opts.site) {
    opts.site = opts.website || opts.s || opts.w;
    delete opts.website;
    delete opts.s;
    delete opts.w;
  }

  if (!opts.paths) {
    opts.paths = opts.path || opts.p;
    delete opts.path;
    delete opts.p;
  }

  if (!opts.startImmediately) {
    opts.startImmediately = opts.immediately || opts.start || opts.i;
    delete opts.immediately;
    delete opts.start;
    delete opts.i;
  }

  return opts;
}
