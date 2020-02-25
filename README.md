# Directory to IIS Application

Windows service used to watch for specific paths of IIS website and convert them to IIS Applications.

## Use Case

Imagine, you have dynamic catalog (e.g. Jenkins workspace) and you want to convert each `dist` folder inside this workspace that contains `web.config` to IIS application (maybe even with subdomain rewrite). So `dir-to-iis-app` service will watch for any `/glob/to/web.config` and add it into IIS app host config.

## Install

```sh
npm install -g dir-to-iis-app
```

## Service

### Install

### Uninstall

