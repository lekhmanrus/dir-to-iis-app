import { normalize, join } from 'path';
import { copyFileSync, readFileSync, statSync } from 'fs';
import { EventLogger, elevate } from 'node-windows';
import { exec } from 'child_process';
import { toJson } from 'xml2json';

import { SiteApplicationShort } from './site-application-short';

export class AppHostConfig {
  public readonly iisDirectory = normalize('C:/Windows/System32/inetsrv/');
  public readonly appHostConfigDirectory = join(this.iisDirectory, 'Config/');
  public readonly appHostConfigPath = join(this.appHostConfigDirectory, 'applicationHost.config');
  public appHostConfig: any;
  public sites: any;
  private readonly _config = readFileSync(this.appHostConfigPath);
  private readonly _logger = new EventLogger({ source: 'application-host-config' });

  public constructor() {
    if (!this._config) {
      const error = 'There is no IIS installed.';
      this._logger.error(error);
      throw new Error(error);
    }
    this.$parseConfig();
  }

  public async getSiteNames(): Promise<string[]> {
    return (await this._execCommand([ 'list', 'site', '/text:name' ], true))
      .filter((site) => Boolean(site));
  }

  public getSite(siteName: string): any {
    return this._getNodeBy(this.sites, (item) => item.name === siteName);
  }

  public getSiteApplication(siteName: string): SiteApplicationShort {
    const site = this.getSite(siteName);
    if (!site) {
      const error = `Site ${siteName} not found in IIS.`;
      this._logger.error(error);
      throw new ReferenceError(error);
    }

    const application = this._getNodeBy(site.application, (item) => item.path === '/');
    if (!application) {
      const error = `There is something weird with ${siteName} config.`;
      this._logger.error(error);
      throw new ReferenceError(error);
    }

    const virtualDirectory = this._getNodeBy(
      application.virtualDirectory,
      (item) => item.path === '/'
    );
    if (!virtualDirectory) {
      const error = `There is something weird with ${siteName} config.`;
      this._logger.error(error);
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
      this._logger.warn(error);
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

    this._logger.info(`${application.path} application has been added to ${siteName} IIS site.`);
  }

  public async removeSiteApplication(siteName: string, applicationPath: string): Promise<void> {
    await this._execCommand([ 'delete', 'app', `${siteName}${applicationPath}` ]);

    this._logger.info(`${applicationPath} application has been removed from ${siteName} IIS site.`);
  }

  public existsSiteApplication(siteName: string, applicationPath: string): boolean {
    const site = this.getSite(siteName);
    if (!site) {
      const error = `Site ${siteName} not found in IIS.`;
      this._logger.warn(error);
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
    this._logger.info(`Config backup has been saved to ${bakPath}.`);
  }

  protected $parseConfig(): void {
    this.appHostConfig = JSON.parse(toJson(String(this._config), {
      reversible: true,
      trim: false
    }));
    if (!this.appHostConfig) {
      const error = `IIS application host config can't be parsed.`;
      this._logger.info(error);
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

  private async _execCommand(args: string[], hasOutput = false): Promise<string[]> {
    return new Promise((promiseResolve, promiseReject) => {
      const fn = hasOutput ? exec : elevate as typeof exec;
      fn(
        [ 'appcmd.exe', ...args ].join(' '),
        { cwd: this.iisDirectory /* windowsHide: true */ },
        (error, stdout, stderr) => {
          if (error) {
            this._logger.error(error.message);
          }

          if (stderr) {
            this._logger.error(stderr);
          }

          if (error || stderr) {
            promiseReject();
          }

          promiseResolve(stdout ? String(stdout).split('\r\n') : [ stdout ]);
        }
      );
    });
  }
}