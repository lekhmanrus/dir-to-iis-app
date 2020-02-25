import { watch } from 'chokidar';
import { parse, relative, resolve } from 'path';
import 'colors';

import { AppHostConfig } from './app-host-config';
import { Logger } from './logger';
import { WatcherOptions } from './watcher-options';
import { SiteApplicationShort } from './site-application-short';

export class Watcher {
  public config: AppHostConfig;
  public siteApplication: SiteApplicationShort;

  public constructor(public readonly options: WatcherOptions) {
    Logger.info(`Watcher options ${JSON.stringify(this.options)}`, 'watcher');
    this.config = new AppHostConfig();
    this.siteApplication = this.config.getSiteApplication(this.options.site);
  }

  public run(): void {
    const path = resolve(this.siteApplication.physicalPath, this.options.paths);
    if (!path) {
      const error = `There is something weird with ${this.options.site} config.`;
      Logger.error(error, 'watcher');
      throw new ReferenceError(error);
    }

    const watchOptions = { usePolling: true, interval: 15 * 1000, depth: 3 };
    watch(path, watchOptions).on('add', this.$add.bind(this));
    watch(path, watchOptions).on('unlink', this.$remove.bind(this));
    Logger.info(
      `Started watching on ${this.siteApplication.physicalPath}/${this.options.paths} (${this.options.site})`,
      'watcher'
    );
  }

  protected $add(filePath: string): void {
    const physicalPath = parse(filePath).dir;
    const path = this._toApplicationPath(physicalPath);
    this.config.addSiteApplication(this.options.site, {
      path,
      pool: this.siteApplication.pool,
      physicalPath
    });
  }

  protected $remove(filePath: string): void {
    const physicalPath = parse(filePath).dir;
    const path = this._toApplicationPath(physicalPath);
    this.config.removeSiteApplication(this.options.site, path);
  }

  private _toApplicationPath(physicalPath: string): string {
    const path = relative(this.siteApplication.physicalPath, physicalPath)
      .replace(/\\/g, '/');
    return path[0] === '/' ? path : `/${path}`;
  }
}
