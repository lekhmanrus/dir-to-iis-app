import { watch } from 'chokidar';
import { parse, relative, resolve } from 'path';
import { EventLogger } from 'node-windows';
import 'colors';

import { AppHostConfig } from './app-host-config';
import { WatcherOptions } from './watcher-options';
import { SiteApplicationShort } from './site-application-short';

export class Watcher {
  public readonly config: AppHostConfig;
  public readonly siteApplication: SiteApplicationShort;
  private readonly _logger = new EventLogger({ source: 'watcher' });

  public constructor(public readonly options: WatcherOptions) {
    this._logger.info(`Watcher options ${JSON.stringify(this.options)}`);
    this.config = new AppHostConfig();
    this.siteApplication = this.config.getSiteApplication(this.options.site);
  }

  public run(): void {
    const path = resolve(this.siteApplication.physicalPath, this.options.paths);
    if (!path) {
      const error = `There is something weird with ${this.options.site} config.`;
      this._logger.error(error);
      throw new ReferenceError(error);
    }

    this._logger.info(`Starting watching on ${path} (${this.options.site})`);
    const watchOptions = {
      usePolling: true,
      interval: Number(this.options.interval),
      depth: this.options.depth > -1 ? Number(this.options.depth) : undefined
    };
    watch(path, watchOptions).on('add', async (filePath) => await this.$add(filePath));
    watch(path, watchOptions).on('unlink', async (filePath) => await this.$remove(filePath));
  }

  protected async $add(filePath: string): Promise<void> {
    const physicalPath = parse(filePath).dir;
    const path = this._toApplicationPath(physicalPath);
    await this.config.addSiteApplication(this.options.site, {
      path,
      pool: this.siteApplication.pool,
      physicalPath
    });
  }

  protected async $remove(filePath: string): Promise<void> {
    const physicalPath = parse(filePath).dir;
    const path = this._toApplicationPath(physicalPath);
    await this.config.removeSiteApplication(this.options.site, path);
  }

  private _toApplicationPath(physicalPath: string): string {
    const path = relative(this.siteApplication.physicalPath, physicalPath)
      .replace(/\\/g, '/');
    return path[0] === '/' ? path : `/${path}`;
  }
}
