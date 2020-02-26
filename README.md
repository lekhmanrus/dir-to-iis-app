# Directory to IIS Application

Windows service used to watch for specific paths of IIS website and convert them to IIS Applications.

## Use Case

Imagine, you have dynamic catalog (e.g. Jenkins workspace) and you want to convert each `dist` folder inside this workspace that contains `web.config` to IIS application (maybe even with subdomain rewrite). So `dir-to-iis-app` service will watch for any `/glob/to/web.config` and add it into IIS app host config.

## Install

```sh
npm install -g dir-to-iis-app
```

## Options

| Name                 | Aliases | Description                                                     |
|----------------------|---------|-----------------------------------------------------------------|
| `--help`             | `-h`    | Show help.                                                      |
| `--install`          |         | Install Windows service.                                        |
| `--uninstall`        |         | Uninstall Windows service.                                      |
| `--name`             | `-n`    | Windows service name to install/uninstall (don't confuse with the display name. |
| `--site`             | `-s`, `--website`, `-w` | IIS website name. Name should match to the website at IIS. |
| `--paths`            | `-p`, `--path` | Paths to files, dirs to be watched recursively, or glob patterns. |
| `--interval`         | `-i`    | Interval of file system polling, in milliseconds.               |
| `--depth`            | `-d`    | Limits how many levels of subdirectories will be traversed? (Leave -1 to unlimited) |
| `--startImmediately` | `-r`, `--immediately`, `--start` | Should the service get started immediately. |

## Service

### Install

```sh
dir-to-iis-app
```

![Service Install](https://raw.githubusercontent.com/lekhmanrus/dir-to-iis-app/master/assets/service-install.gif)

or

```sh
dir-to-iis-app --install --name=test --site=dir2iisapp.local --paths="!(*@tmp)/**/[Ww]eb.config" --interval=15000 -d 3 -r
```


### Uninstall

![Service Uninstall](https://raw.githubusercontent.com/lekhmanrus/dir-to-iis-app/master/assets/service-uninstall.gif)

or

```sh
dir-to-iis-app --uninstall --name=test
```
