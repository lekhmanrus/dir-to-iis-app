import { normalize, join, resolve } from 'path';
import { copyFileSync, readFileSync, statSync, writeFile } from 'fs';
import { toJson, toXml } from 'xml2json';

import { Logger } from './logger';
import { SiteApplicationShort } from './site-application-short';

export class AppHostConfig {
  public readonly appHostConfigDirectory = normalize('C:/Windows/System32/inetsrv/Config/');
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

  public addSiteApplication(siteName: string, application: SiteApplicationShort): any {
    if (this.existsSiteApplication(siteName, application.path)) {
      const error = `${application.path} application already exists at ${siteName} IIS site.`;
      Logger.error(error, 'application-host-config');
      return;
    }

    const site = this.getSite(siteName);
    if (!Array.isArray(site.application)) {
      site.application = [ site.application ];
    }

    site.application.push({
      path: application.path,
      applicationPool: application.pool,
      virtualDirectory: {
        path: '/',
        physicalPath: application.physicalPath
      }
    });

    Logger.info(
      `${application.path} application has been added to ${siteName} IIS site.`,
      'application-host-config'
    );
    this._saveConfig();
  }

  public removeSiteApplication(siteName: string, applicationPath: string): any {
    const site = this.getSite(siteName);
    if (!site) {
      const error = `Site ${siteName} not found in IIS.`;
      Logger.error(error, 'application-host-config');
      throw new ReferenceError(error);
    }

    if (!Array.isArray(site.application)) {
      site.application = [ site.application ];
    }

    site.application = site.application.filter((item: any) => item.path !== applicationPath);

    if (site.application.length === 1) {
      site.application = site.application.pop();
    }

    Logger.info(
      `${applicationPath} application has been removed from ${siteName} IIS site.`,
      'application-host-config'
    );
    this._saveConfig();
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

  private _saveConfig(): void {
    writeFile(
      resolve(this.appHostConfigPath),
      toXml(JSON.stringify(this.appHostConfig)),
      () => Logger.info('Config saved.', 'application-host-config')
    );
  }
}