import { resolve } from 'path';
import { Service, ServiceConfig } from 'node-windows';
import prompts from 'prompts';
import 'colors';

import { AppHostConfig } from './app-host-config';
import { Logger } from './logger';

export class DirToIisAppService {
  private _config: AppHostConfig;

  public constructor(public readonly argv: any) {
    this._config = new AppHostConfig();
  }

  public async install() {
    this._config.saveBackup();
    await this.readOptions(await this.promptOptions());
  }

  public async uninstall() {
    const options = (await this.promptOptions()).filter((option) => option.name === 'name');
    await this.readOptions(options);
  }

  public async promptOptions(): Promise<prompts.PromptObject[]> {
    return [
      {
        type: 'text',
        name: 'name',
        message: 'Service name',
        validate: (name) => /^[a-zA-Z\-]+$/.test(name) || 'Name must be only letters or dashes'
      },
      {
        type: 'select',
        name: 'site',
        message: 'IIS website name',
        choices: (await this._config.getSiteNames()).map((site) => ({ title: site, value: site }))
      },
      {
        type: 'text',
        name: 'paths',
        message: 'Paths to web.config files to be watched recursively, or glob patterns'
      },
      {
        type: 'number',
        name: 'interval',
        message: 'Interval of file system polling, in milliseconds.',
        initial: 15000,
        min: 1,
        increment: 1000,
        validate: (interval: number) => (interval > 0) || `Should be greater than 0.`
      } as any,
      {
        type: 'number',
        name: 'depth',
        message: 'Limits how many levels of subdirectories will be traversed? (Leave -1 to unlimited)',
        initial: -1,
        min: -1,
        validate: (depth) => (depth >= -1) || `Should be greater than or equal to -1.`
      },
      {
        type: 'toggle',
        name: 'startImmediately',
        message: 'Should the service get started immediately?',
        initial: true,
        active: 'yes',
        inactive: 'no'
      }
    ];
  }

  public async readOptions(options: prompts.PromptObject[]): Promise<void> {
    prompts.override(this.argv);
    const values = await prompts(options);
    values.paths = this._wrapByQuotes(values.paths);
    this.run(values);
  }

  public run({ name, startImmediately, ...options }: any): void {
    const serviceOptions: ServiceConfig = {
      name,
      description: `Directories watcher by pattern to add it to IIS website ${options.site} as applications.`,
      script: resolve(__dirname, './run-watcher.js'),
      scriptOptions: Object
        .entries(options)
        .map(([ key, value ]) => `--${key}=${value}`)
        .join(' ')
    } as any;
    const service = new Service(serviceOptions);
    this._bindEvents(service, startImmediately);
    service[this.argv.uninstall ? 'uninstall' : 'install']();
    Logger.info(
      `Service ${this.argv.uninstall ? 'uninstall' : 'install'}ed: ${JSON.stringify(serviceOptions)}.`,
      'service'
    );
  }

  private _wrapByQuotes(path: string): string {
    let correctPath = String(path).trim();
    if (correctPath.startsWith(`"`) || correctPath.startsWith(`'`)) {
      correctPath = correctPath.slice(1);
    }
    if (correctPath.endsWith(`"`) || correctPath.endsWith(`'`)) {
      correctPath = correctPath.slice(0, -1);
    }
    return `"${correctPath}"`;
  }

  private _bindEvents(service: Service, startImmediately: boolean): void {
    service.on('alreadyInstalled', () => console.log('Service already installed.'.cyan));
    service.on(
      'invalidInstallation',
      () => console.log('Invalid service installation (installation is detected but required files are missing).'.red)
    );
    service.on('uninstall', () => console.log('Service uninstalled.'.blue));
    service.on('start', () => console.log('Service started.'.green));
    service.on('stop', () => console.log('Service stopped.'.yellow));
    service.on('error', () => console.log('An error occurred.'.red));
    service.on('install', () => {
      console.log('Service installed.'.green);
      if (startImmediately) {
        service.start();
      }
    });
  }
}