import { normalize, join } from 'path';
import { copyFileSync, readFileSync, statSync } from 'fs';
import { execFile } from 'child_process';
import { toJson } from 'xml2json';

import { Logger } from './logger';
import { SiteApplicationShort } from './site-application-short';

export class AppHostConfig {
  public readonly iisDirectory = normalize('C:/Windows/System32/inetsrv/');
  public readonly appHostConfigDirectory = join(this.iisDirectory, 'Config/');
  public readonly appHostConfigPath = join(this.appHostConfigDirectory, 'applicationHost.config');
  public appHostConfig: any;
  public sites: any;
  private readonly _config = readFileSync(this.appHostConfigPath);

  public constructor() {
    if (!this._config) {
      const error = 'There is no IIS installed.';
      Logger.error(error, 'application-host-config');
      throw new Error(error);
    }
    this.$parseConfig();
  }

  public async getSiteNames(): Promise<string[]> {
    return (await this._execCommand([ 'list', 'site', '/text:name' ]))
      .filter((site) => Boolean(site));
  }

  public getSite(siteName: string): any {
    return this._getNodeBy(this.sites, (item) => item.name === siteName);
  }

  public getSiteApplication(siteName: string): SiteApplicationShort {
    const site = this.getSite(siteName);
    if (!site) {
      const error = `Site ${siteName} not found in IIS.`;
      Logger.error(error, 'application-host-config');
      throw new ReferenceError(error);
    }

    const application = this._getNodeBy(site.application, (item) => item.path === '/');
    if (!application) {
      const error = `There is something weird with ${siteName} config.`;
      Logger.error(error, 'application-host-config');
      throw new ReferenceError(error);
    }

    const virtualDirectory = this._getNodeBy(
      application.virtualDirectory,
      (item) => item.path === '/'
    );
    if (!virtualDirectory) {
      const error = `There is something weird with ${siteName} config.`;
      Logger.error(error, 'application-host-config');
      throw new ReferenceError(error);
    }

    return {
      path: application.path,
      pool: application.applicationPool,
      physicalPath: virtualDirectory.physicalPath
    };
  }

  public async addSiteApplication(siteName: string, application: SiteApplicationShort): Promise<void> {
    if (this.existsSiteApplication(siteName, application.path)) {
      const error = `${application.path} application already exists at ${siteName} IIS site.`;
      Logger.error(error, 'application-host-config');
      return;
    }

    await this._execCommand([
      'add',
      'app',
      `/site.name:${siteName}`,
      `/path:${application.path}`,
      `/physicalPath:${application.physicalPath}`
    ]);

    await this._execCommand([
      'set',
      'app',
      `${siteName}${application.path}`,
      `/applicationPool:${application.pool}`
    ]);

    Logger.info(
      `${application.path} application has been added to ${siteName} IIS site.`,
      'application-host-config'
    );
  }

  public async removeSiteApplication(siteName: string, applicationPath: string): Promise<void> {
    await this._execCommand([ 'delete', 'app', `${siteName}${applicationPath}` ]);

    Logger.info(
      `${applicationPath} application has been removed from ${siteName} IIS site.`,
      'application-host-config'
    );
  }

  public existsSiteApplication(siteName: string, applicationPath: string): boolean {
    const site = this.getSite(siteName);
    if (!site) {
      const error = `Site ${siteName} not found in IIS.`;
      Logger.error(error, 'application-host-config');
      throw new ReferenceError(error);
    }

    let applications = site.application;
    if (!Array.isArray(applications)) {
      applications = [ applications ];
    }

    return Boolean(applications.filter((item: any) => item.path === applicationPath).length);
  }

  public saveBackup(): void {
    let bakFileName = 'applicationHost.config.bak';
    try {
      statSync(join(this.appHostConfigDirectory, bakFileName));
      let index = 0;
      while (true) {
        bakFileName = `applicationHost.config.${index++}.bak`;
        statSync(join(this.appHostConfigDirectory, bakFileName));
      }
    // tslint:disable-next-line:no-empty
    } catch { }
    const bakPath = join(this.appHostConfigDirectory, bakFileName);
    copyFileSync(this.appHostConfigPath, bakPath);
    Logger.info(`Config backup has been saved to ${bakPath}.`, 'application-host-config');
  }

  protected $parseConfig(): void {
    this.appHostConfig = JSON.parse(toJson(String(this._config), {
      reversible: true,
      trim: false
    }));
    if (!this.appHostConfig) {
      const error = `IIS application host config can't be parsed.`;
      Logger.error(error, 'application-host-config');
      throw new ReferenceError(error);
    }

    this.sites = this.appHostConfig.configuration['system.applicationHost'].sites.site;
    if (!Array.isArray(this.sites)) {
      this.sites = [ this.sites ];
    }
  }

  private _getNodeBy(node: any, iteratee: ((item: any) => boolean)): any {
    if (Array.isArray(node)) {
      return node.filter(iteratee).pop();
    }
    if (iteratee(node)) {
      return node;
    }
    return undefined;
  }

  private async _execCommand(args: string[]): Promise<string[]> {
    const commands = args; // .map((arg) => arg.replace(/\\/g, '\\\\').replace(/\//g, '\\\/'));
    return new Promise((promiseResolve, promiseReject) => {
      execFile(join(this.iisDirectory, 'appcmd.exe'), commands, (error, stdout, stderr) => {
        if (error) {
          Logger.error(error.message, 'application-host-config');
        }

        if (stderr) {
          Logger.error(stderr, 'application-host-config');
        }

        if (error || stderr) {
          promiseReject();
        }

        promiseResolve(String(stdout).split('\r\n'));
      });
    });
  }
}