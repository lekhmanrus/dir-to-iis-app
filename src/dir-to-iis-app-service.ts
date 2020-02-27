import { resolve } from 'path';
import { EventLogger, Service, ServiceConfig } from 'node-windows';
import prompts from 'prompts';
import 'colors';

import { AppHostConfig } from './app-host-config';

export class DirToIisAppService {
  private readonly _config: AppHostConfig;
  private readonly _logger = new EventLogger({ source: 'dir-to-iis-app-service' });

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
        .join(' '),
      abortOnError: true
    } as any;
    const service = new Service(serviceOptions);
    this._bindEvents(name, service, startImmediately);
    let message = `${name} service installing: ${JSON.stringify(serviceOptions)}.`;
    if (this.argv.uninstall) {
      message = `${name} service uninstalling.`;
    }
    this._logger.info(message);
    console.log(message.gray);
    service[this.argv.uninstall ? 'uninstall' : 'install']();
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

  private _bindEvents(name: string, service: Service, startImmediately: boolean): void {
    service.on('alreadyInstalled', () => {
      const message = `${name} service already installed.`;
      this._logger.info(message);
      console.log(message.cyan);
    });
    service.on('invalidInstallation', () => {
      const message = `Invalid ${name} service installation (installation is detected but required files are missing).`;
      this._logger.error(message);
      console.log(message.red);
    });
    service.on('uninstall', () => {
      const message = `${name} service uninstalled.`;
      this._logger.info(message);
      console.log(message.magenta);
    });
    service.on('start', () => {
      const message = `${name} service started.`;
      this._logger.info(message);
      console.log(message.green);
    });
    service.on('stop', () => {
      const message = `${name} service stopped.`;
      this._logger.info(message);
      console.log(message.yellow);
    });
    service.on('error', () => {
      const message = `${name} service: an error occurred.`;
      this._logger.error(message);
      console.log(message.red);
    });
    service.on('install', () => {
      let message = `${name} service installed.`;
      this._logger.info(message);
      console.log(message.green);
      if (startImmediately) {
        message = `${name} service starting.`;
        this._logger.info(message);
        console.log(message.gray);
        service.start();
      }
    });
  }
}