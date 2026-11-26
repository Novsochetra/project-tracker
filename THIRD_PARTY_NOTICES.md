# Third-party notices

The tracker's own code is under the license in [LICENSE](LICENSE). It uses the third-party software below, which keeps its own license. The versions are the ones in `package-lock.json` when this file was written. Each copyright line is copied from the package's license file, or from its README when the license file names no one. After `npm ci`, most packages' folders in `node_modules` hold their license text, in a license file or the README. The exceptions are the entries below that say "No license file" and sharp's libvips packages (see "libvips").

Where the code goes:

- **Web app:** the build puts the code of the packages under "Web app" below into the files that browsers download, and copies the Geist font files next to them.
- **Server and agent:** the server, the MCP server and the `tracker` CLI are built with tsup, which bundles only the tracker's own packages. Their third-party packages, under "Other production dependencies" below, stay in `node_modules` and load at run time.
- **Images:** the server processes images with sharp, which uses the libvips library from separate packages (see "libvips" below).

## libvips (LGPL-3.0-or-later)

`sharp` 0.35.5 (Apache-2.0) processes images with libvips 8.18.7. npm installs sharp's native binaries from two optional packages that match the machine's platform:

- `@img/sharp-<platform>` 0.35.5 (Apache-2.0, Copyright 2013 Lovell Fuller and others.): sharp's compiled module.
- `@img/sharp-libvips-<platform>` 1.3.4 (LGPL-3.0-or-later): libvips and the libraries it uses, built into one shared library in the package's `lib` folder (on macOS, `libvips-cpp.8.18.7.dylib`). The package has no license file, only the README table below.

On Windows there is no separate libvips package: `@img/sharp-win32-<arch>` 0.35.5 holds sharp's module and libvips together, under Apache-2.0 AND LGPL-3.0-or-later.

npm also installs `@img/sharp-wasm32` 0.35.5 (Apache-2.0 AND LGPL-3.0-or-later AND MIT, Copyright 2013 Lovell Fuller and others.) on every platform, with its dependency `@emnapi/runtime` (listed under MIT below), because their lockfile entries name no platform. sharp loads it only when no native binary loads. It is a WebAssembly build of sharp with libvips and its libraries linked statically into one file, `lib/sharp-wasm32-0.35.5.node.wasm`. Its LICENSE file has sharp's Apache-2.0 text only.

The READMEs of `@img/sharp-libvips-darwin-arm64` 1.3.4 and `@img/sharp-wasm32` 0.35.5 list what is built into each and the license each part is used under; the versions are from their `versions.json`. In the last column, native means `@img/sharp-libvips-<platform>` and WebAssembly means `@img/sharp-wasm32`.

| Library       | Version        | License                                                   | Built into  |
| ------------- | -------------- | --------------------------------------------------------- | ----------- |
| aom           | 3.15.1         | BSD 2-Clause + Alliance for Open Media Patent License 1.0 | both        |
| cairo         | 1.18.6         | Mozilla Public License 1.1                                | native      |
| cgif          | 0.5.4          | MIT License                                               | both        |
| emscripten    | 6.0.10         | MIT License                                               | WebAssembly |
| expat         | 2.8.5          | MIT License                                               | both        |
| fontconfig    | 2.18.3         | fontconfig License (BSD-like)                             | native      |
| freetype      | 2.14.3         | freetype License (BSD-like)                               | native      |
| fribidi       | 1.0.17         | LGPLv3                                                    | native      |
| glib          | 2.90.0         | LGPLv3                                                    | both        |
| harfbuzz      | 14.5.0         | MIT License                                               | native      |
| highway       | 1.4.0          | BSD 3-Clause                                              | both        |
| lcms          | 2.19.1         | MIT License                                               | both        |
| libarchive    | 3.8.9          | BSD 2-Clause                                              | native      |
| libexif       | 0.6.26         | LGPLv3                                                    | both        |
| libffi        | 3.8.0          | MIT License                                               | both        |
| libheif       | 1.23.5         | LGPLv3                                                    | both        |
| libimagequant | 2.4.1          | BSD 2-Clause                                              | both        |
| libnsgif      | not listed     | MIT License                                               | both        |
| libpng        | 1.6.58         | libpng License                                            | both        |
| librsvg       | 2.63.2         | LGPLv3                                                    | native      |
| libtiff       | 4.7.2          | libtiff License (BSD-like)                                | both        |
| libultrahdr   | 2.0.2          | MIT License                                               | both        |
| libvips       | 8.18.7         | LGPLv3                                                    | both        |
| libwebp       | 1.6.0          | New BSD License                                           | both        |
| libxml2       | 2.15.4         | MIT License                                               | native      |
| mozjpeg       | commit 0826579 | zlib License, IJG License, BSD 3-Clause                   | both        |
| pango         | 1.58.2         | LGPLv3                                                    | native      |
| pixman        | 0.46.4         | MIT License                                               | native      |
| proxy-libintl | 0.5            | LGPLv3                                                    | native      |
| resvg         | 0.48.1         | MIT License                                               | WebAssembly |
| zlib-ng       | 2.3.3          | zlib License                                              | both        |

The READMEs add that the LGPLv3 libraries are used under the "any later version" clause of their LGPLv2 or LGPLv2.1 license.

### Getting the source

- The native libraries are built by sharp-libvips release v1.3.4: https://github.com/lovell/sharp-libvips/releases/tag/v1.3.4
- Its build scripts, at https://github.com/lovell/sharp-libvips/tree/v1.3.4, download each library's source from the library's own project at the versions above and compile it. Before compiling, `build/posix.sh` applies five downloaded patches (`glib-without-gregex.patch` to glib, commit patches to mozjpeg and librsvg, pull request 383 to libultrahdr, and `libvips-cpp-soversion.patch` to libvips; glib, librsvg and libvips are LGPL) and edits some sources in place, so the source of what ships is each upstream release as that script changes it.
- The WebAssembly build's libraries come from `build/wasm.sh` at the same tag, which builds libvips and its libraries as static WebAssembly libraries with the wasm-vips project: https://github.com/kleisauke/wasm-vips
- The libvips 8.18.7 source: https://github.com/libvips/libvips/releases/tag/v8.18.7

### Replacing the library

sharp's compiled module links to libvips dynamically: the system loads the library from `node_modules/@img/sharp-libvips-<platform>/lib` when sharp is loaded. To run sharp with a changed or newer libvips, either:

- replace that library file with an interface-compatible build of libvips 8.18.7, or
- install libvips 8.18.7 or later where `pkg-config --modversion vips-cpp` finds it, then rebuild sharp against it with `npm explore sharp -- npm run build`. The build needs a C++17 compiler, node-addon-api 7 or later and node-gyp 9 or later. `SHARP_FORCE_GLOBAL_LIBVIPS=1` makes it use the installed libvips even when the version check fails. sharp does not support an installed libvips on Windows, or on macOS when Node.js runs under Rosetta. sharp's install guide has the details: https://sharp.pixelplumbing.com/install

This does not apply to `@img/sharp-wasm32`: its libvips is linked statically into its `.wasm` file, so using a changed libvips there means rebuilding that file. sharp builds it from its own source with Emscripten (its build runs node-gyp with `--nodedir=emscripten` when `CC` is Emscripten's `emcc`), against the WebAssembly libraries from sharp-libvips' `build/wasm.sh`.

The LGPL 3.0 text is linked under "License texts" below.

## Geist fonts (SIL OFL 1.1)

The web app uses the Geist and Geist Mono variable fonts from `@fontsource-variable/geist` 5.3.0 and `@fontsource-variable/geist-mono` 5.3.0. The build copies their `woff2` files into the web app. Their license files start with these notices:

```text
Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font) Geist-Italic[wght].ttf: Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font.git) GeistMono-Italic[wght].ttf: Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font.git)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL
```

The full license is under "License texts" below.

## Web app

The build puts the code of these packages into the files that browsers download. Workbox, `idb`, `vite-plugin-pwa` and Vite come in with the build tools, so npm counts them as development dependencies, but parts of them ship: Workbox and `idb` in the service worker (`sw.js`), and `workbox-window`, the registration code from `vite-plugin-pwa` and Vite's module preload helper in the app.

### MIT

- `@tanstack/query-core` 5.104.1: Copyright (c) 2021-present Tanner Linsley
- `@tanstack/react-query` 5.104.1: Copyright (c) 2021-present Tanner Linsley
- `clsx` 2.1.1: Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)
- `framer-motion` 14.0.0: Copyright (c) 2018 Framer B.V.
- `motion` 14.0.0: Copyright (c) 2024 [Motion](https://motion.dev) B.V.
- `motion-dom` 14.0.0: Copyright (c) 2024 [Motion](https://motion.dev) B.V.
- `motion-utils` 14.0.0: Copyright (c) 2024 [Motion](https://motion.dev) B.V.
- `react` 19.3.0: Copyright (c) Meta Platforms, Inc. and affiliates.
- `react-dom` 19.3.0: Copyright (c) Meta Platforms, Inc. and affiliates.
- `react-router` 8.4.0:
  - Copyright (c) React Training LLC 2015-2019
  - Copyright (c) Remix Software Inc. 2020-2021
  - Copyright (c) Shopify Inc. 2022-2023
- `scheduler` 0.28.0: Copyright (c) Meta Platforms, Inc. and affiliates.
- `vite` 8.3.3 (its module preload helper): Copyright (c) 2019-present, VoidZero Inc. and Vite contributors
- `vite-plugin-pwa` 2.0.0 (its service worker registration code): Copyright (c) 2020-PRESENT Anthony Fu <https://github.com/antfu>
- `workbox-cacheable-response` 7.4.1: Copyright 2018 Google LLC
- `workbox-core` 7.4.1: Copyright 2018 Google LLC
- `workbox-expiration` 7.4.1: Copyright 2018 Google LLC
- `workbox-precaching` 7.4.1: Copyright 2018 Google LLC
- `workbox-routing` 7.4.1: Copyright 2018 Google LLC
- `workbox-strategies` 7.4.1: Copyright 2018 Google LLC
- `workbox-window` 7.4.1: Copyright 2018 Google LLC

### ISC

- `idb` 7.1.1: Copyright (c) 2016, Jake Archibald <jaffathecake@gmail.com>
- `lucide-react` 1.52.0:
  - Copyright (c) 2026 Lucide Icons and Contributors
  - The icons derived from Feather, under the MIT License: Copyright (c) 2013-present Cole Bemis

## Other production dependencies

These are the other packages in the production dependency tree (`npm ls --omit=dev --all`). The words after each version say what uses the package: the server, the agent (the MCP server and the `tracker` CLI), or the web app, whose build leaves out the code of the packages marked "web but not bundled". sharp's platform packages are under "libvips" above.

### MIT

- `@emnapi/runtime` 1.11.3 (server): Copyright (c) 2021-present Toyobayashi
- `@hono/node-server` 2.1.11 (server, agent): Copyright (c) 2022 - present, Yusuke Wada and Hono contributors
- `@hono/zod-validator` 0.9.1 (server): No license file in the package; its README names Yusuke Wada as author
- `@img/colour` 1.1.0 (server):
  - color: Copyright (c) 2012 Heather Arthur
  - color-convert: Copyright (c) 2011-2016 Heather Arthur <fayearthur@gmail.com>.
  - color-convert: Copyright (c) 2016-2021 Josh Junon <josh@junon.me>.
  - color-string: Copyright (c) 2011 Heather Arthur <fayearthur@gmail.com>
  - color-name: Copyright (c) 2015 Dmitry Ivanov
- `@modelcontextprotocol/sdk` 1.32.1 (agent): Copyright (c) 2024 Anthropic, PBC
- `@remix-run/route-pattern` 0.22.1 (web but not bundled): Copyright (c) 2025 Shopify Inc.
- `@types/react` 19.3.0 (web but not bundled): Copyright (c) Microsoft Corporation.
- `@use-gesture/core` 10.3.1 (web but not bundled): Copyright (c) 2018-present Paul Henschel <drcmda@gmail.com>
- `@use-gesture/react` 10.3.1 (web but not bundled): Copyright (c) 2018-present Paul Henschel <drcmda@gmail.com>
- `accepts` 2.0.0 (agent):
  - Copyright (c) 2014 Jonathan Ong <me@jongleberry.com>
  - Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
- `ajv` 8.20.0 (agent): Copyright (c) 2015-2021 Evgeny Poberezkin
- `ajv-formats` 3.0.1 (agent): Copyright (c) 2020 Evgeny Poberezkin
- `base64-js` 1.5.1 (server): Copyright (c) 2014 Jameson Little
- `better-sqlite3` 13.0.3 (server):
  - Copyright (c) 2017 Joshua Wise
  - It includes SQLite 3.53.4, whose source says "The author disclaims copyright to this source code."
- `body-parser` 2.4.0 (agent):
  - Copyright (c) 2014 Jonathan Ong <me@jongleberry.com>
  - Copyright (c) 2014-2015 Douglas Christopher Wilson <doug@somethingdoug.com>
- `bowser` 2.14.1 (server): Copyright 2015, Dustin Diaz (the "Original Author")
- `buffer` 5.6.0 (server): Copyright (c) Feross Aboukhadijeh, and other contributors.
- `bytes` 3.1.2 (agent):
  - Copyright (c) 2012-2014 TJ Holowaychuk <tj@vision-media.ca>
  - Copyright (c) 2015 Jed Watson <jed.watson@me.com>
- `call-bind-apply-helpers` 1.0.2 (agent): Copyright (c) 2024 Jordan Harband
- `call-bound` 1.0.4 (agent): Copyright (c) 2024 Jordan Harband
- `content-disposition` 1.1.0 (agent): Copyright (c) 2014-2017 Douglas Christopher Wilson
- `content-type` 1.0.5 (agent): Copyright (c) 2015 Douglas Christopher Wilson
- `content-type` 2.1.0 (agent): Copyright (c) 2015 Douglas Christopher Wilson
- `cookie` 0.7.2 (agent):
  - Copyright (c) 2012-2014 Roman Shtylman <shtylman@gmail.com>
  - Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
- `cookie-es` 3.1.1 (web but not bundled):
  - Cookie-es copyright (c) Pooya Parsa <pooya@pi0.io>
  - Copyright (c) 2012-2014 Roman Shtylman <shtylman@gmail.com>
  - Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
  - Copyright (c) 2015 Nathan Friedly <nathan@nfriedly.com> (http://nfriedly.com/)
- `cookie-signature` 1.2.2 (agent): Copyright (c) 2012–2024 LearnBoost <tj@learnboost.com> and other contributors;
- `cors` 2.8.6 (agent): Copyright (c) 2013 Troy Goode <troygoode@gmail.com>
- `cross-spawn` 7.0.6 (agent): Copyright (c) 2018 Made With MOXY Lda <hello@moxy.studio>
- `csstype` 3.2.3 (web but not bundled): Copyright (c) 2017-2018 Fredrik Nicol
- `debug` 4.4.3 (agent):
  - Copyright (c) 2014-2017 TJ Holowaychuk <tj@vision-media.ca>
  - Copyright (c) 2018-2021 Josh Junon
- `depd` 2.0.0 (agent): Copyright (c) 2014-2018 Douglas Christopher Wilson
- `dunder-proto` 1.0.1 (agent): Copyright (c) 2024 ECMAScript Shims
- `ee-first` 1.1.1 (agent): Copyright (c) 2014 Jonathan Ong me@jongleberry.com
- `encodeurl` 2.0.0 (agent): Copyright (c) 2016 Douglas Christopher Wilson
- `es-define-property` 1.0.1 (agent): Copyright (c) 2024 Jordan Harband
- `es-errors` 1.3.0 (agent): Copyright (c) 2024 Jordan Harband
- `es-object-atoms` 1.1.2 (agent): Copyright (c) 2024 Jordan Harband
- `escape-html` 1.0.3 (agent):
  - Copyright (c) 2012-2013 TJ Holowaychuk
  - Copyright (c) 2015 Andreas Lubbe
  - Copyright (c) 2015 Tiancheng "Timothy" Gu
- `etag` 1.8.1 (agent): Copyright (c) 2014-2016 Douglas Christopher Wilson
- `events` 3.3.0 (server): Copyright Joyent, Inc. and other Node contributors.
- `eventsource` 3.0.7 (agent): Copyright (c) EventSource GitHub organisation
- `eventsource-parser` 3.1.1 (agent): Copyright (c) 2026 Espen Hovlandsdal <espen@hovlandsdal.com>
- `express` 5.2.1 (agent):
  - Copyright (c) 2009-2014 TJ Holowaychuk <tj@vision-media.ca>
  - Copyright (c) 2013-2014 Roman Shtylman <shtylman+expressjs@gmail.com>
  - Copyright (c) 2014-2015 Douglas Christopher Wilson <doug@somethingdoug.com>
- `express-rate-limit` 8.7.1 (agent): Copyright 2023 Nathan Friedly, Vedant K
- `fast-deep-equal` 3.1.3 (agent): Copyright (c) 2017 Evgeny Poberezkin
- `finalhandler` 2.1.1 (agent): Copyright (c) 2014-2022 Douglas Christopher Wilson <doug@somethingdoug.com>
- `forwarded` 0.2.0 (agent): Copyright (c) 2014-2017 Douglas Christopher Wilson
- `fresh` 2.0.0 (agent):
  - Copyright (c) 2012 TJ Holowaychuk <tj@vision-media.ca>
  - Copyright (c) 2016-2017 Douglas Christopher Wilson <doug@somethingdoug.com>
- `function-bind` 1.1.2 (agent): Copyright (c) 2013 Raynos.
- `get-intrinsic` 1.3.0 (agent): Copyright (c) 2020 Jordan Harband
- `get-proto` 1.0.1 (agent): Copyright (c) 2025 Jordan Harband
- `gopd` 1.2.0 (agent): Copyright (c) 2022 Jordan Harband
- `has-symbols` 1.1.0 (agent): Copyright (c) 2016 Jordan Harband
- `hasown` 2.0.4 (agent): Copyright (c) Jordan Harband and contributors
- `hono` 4.13.22 (server, agent): Copyright (c) 2021 - present, Yusuke Wada and Hono contributors
- `http-errors` 2.0.1 (agent):
  - Copyright (c) 2014 Jonathan Ong me@jongleberry.com
  - Copyright (c) 2016 Douglas Christopher Wilson doug@somethingdoug.com
- `iconv-lite` 0.7.3 (agent): Copyright (c) 2011 Alexander Shtuchkin
- `image-size` 2.0.4 (server): Copyright © 2013-Present Aditya Yadav, http://netroy.in
- `ip-address` 10.7.6 (agent): Copyright (C) 2011 by Beau Gunderson
- `ipaddr.js` 1.9.1 (agent): Copyright (C) 2011-2017 whitequark <whitequark@whitequark.org>
- `is-promise` 4.0.0 (agent): Copyright (c) 2014 Forbes Lindesay
- `jose` 6.2.12 (agent): Copyright (c) 2018 Filip Skokan
- `json-schema-traverse` 1.0.0 (agent): Copyright (c) 2017 Evgeny Poberezkin
- `kysely` 0.29.6 (server): Copyright (c) 2022 Sami Koskimäki
- `math-intrinsics` 1.1.0 (agent): Copyright (c) 2024 ECMAScript Shims
- `media-typer` 1.1.1 (agent): Copyright (c) 2014-2017 Douglas Christopher Wilson
- `merge-descriptors` 2.0.0 (agent):
  - Copyright (c) Jonathan Ong <me@jongleberry.com>
  - Copyright (c) Douglas Christopher Wilson <doug@somethingdoug.com>
  - Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
- `mime-db` 1.54.0 (agent):
  - Copyright (c) 2014 Jonathan Ong <me@jongleberry.com>
  - Copyright (c) 2015-2022 Douglas Christopher Wilson <doug@somethingdoug.com>
- `mime-types` 3.0.2 (agent):
  - Copyright (c) 2014 Jonathan Ong <me@jongleberry.com>
  - Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
- `ms` 2.1.3 (agent): Copyright (c) 2020 Vercel, Inc.
- `negotiator` 1.1.0 (agent):
  - Copyright (c) 2012-2014 Federico Romero
  - Copyright (c) 2012-2014 Isaac Z. Schlueter
  - Copyright (c) 2014-2015 Douglas Christopher Wilson
- `node-addon-api` 8.9.2 (server): Copyright (c) 2017 [Node.js API collaborators](https://github.com/nodejs/node-addon-api#collaborators)
- `object-assign` 4.1.1 (agent): Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)
- `object-inspect` 1.13.4 (agent): Copyright (c) 2013 James Halliday
- `on-finished` 2.4.1 (agent):
  - Copyright (c) 2013 Jonathan Ong <me@jongleberry.com>
  - Copyright (c) 2014 Douglas Christopher Wilson <doug@somethingdoug.com>
- `parseurl` 1.3.3 (agent):
  - Copyright (c) 2014 Jonathan Ong <me@jongleberry.com>
  - Copyright (c) 2014-2017 Douglas Christopher Wilson <doug@somethingdoug.com>
- `path-key` 3.1.1 (agent): Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)
- `path-to-regexp` 8.4.2 (agent): Copyright (c) 2014 Blake Embrey (hello@blakeembrey.com)
- `pg` 8.23.1 (server): Copyright (c) 2010 - 2021 Brian Carlson
- `pg-cloudflare` 1.4.1 (server): Copyright (c) 2010 - 2021 Brian Carlson
- `pg-connection-string` 2.14.1 (server): Copyright (c) 2014 Iced Development
- `pg-pool` 3.14.0 (server): Copyright (c) 2017 Brian M. Carlson
- `pg-protocol` 1.16.1 (server): Copyright (c) 2010 - 2021 Brian Carlson
- `pg-types` 2.2.0 (server): Copyright (c) 2014 Brian M. Carlson
- `pgpass` 1.0.5 (server): Copyright (c) 2013-2016 Hannes Hörl
- `pkce-challenge` 5.0.1 (agent): Copyright (c) 2019 (its LICENSE names no holder; its package.json names crouchcd as author)
- `postgres-array` 2.0.0 (server): Copyright (c) Ben Drucker <bvdrucker@gmail.com> (bendrucker.me)
- `postgres-bytea` 1.0.1 (server): Copyright (c) Ben Drucker <bvdrucker@gmail.com> (bendrucker.me)
- `postgres-date` 1.0.7 (server): Copyright (c) Ben Drucker <bvdrucker@gmail.com> (bendrucker.me)
- `postgres-interval` 1.2.0 (server): Copyright (c) Ben Drucker <bvdrucker@gmail.com> (bendrucker.me)
- `proxy-addr` 2.0.8 (agent): Copyright (c) 2014-2016 Douglas Christopher Wilson
- `range-parser` 1.3.0 (agent):
  - Copyright (c) 2012-2014 TJ Holowaychuk <tj@vision-media.ca>
  - Copyright (c) 2015-2016 Douglas Christopher Wilson <doug@somethingdoug.com
- `raw-body` 3.0.2 (agent):
  - Copyright (c) 2013-2014 Jonathan Ong <me@jongleberry.com>
  - Copyright (c) 2014-2022 Douglas Christopher Wilson <doug@somethingdoug.com>
- `readable-stream` 3.6.2 (server):
  - Copyright Node.js contributors. All rights reserved.
  - Copyright Joyent, Inc. and other Node contributors. All rights reserved.
- `require-from-string` 2.0.2 (agent): Copyright (c) Vsevolod Strukchinsky <floatdrop@gmail.com> (github.com/floatdrop)
- `router` 2.2.0 (agent):
  - Copyright (c) 2013 Roman Shtylman
  - Copyright (c) 2014-2022 Douglas Christopher Wilson
- `safe-buffer` 5.2.1 (server): Copyright (c) Feross Aboukhadijeh
- `safer-buffer` 2.1.2 (agent): Copyright (c) 2018 Nikita Skovoroda <chalkerx@gmail.com>
- `send` 1.2.1 (agent):
  - Copyright (c) 2012 TJ Holowaychuk
  - Copyright (c) 2014-2022 Douglas Christopher Wilson
- `serve-static` 2.2.1 (agent):
  - Copyright (c) 2010 Sencha Inc.
  - Copyright (c) 2011 LearnBoost
  - Copyright (c) 2011 TJ Holowaychuk
  - Copyright (c) 2014-2016 Douglas Christopher Wilson
- `shebang-command` 2.0.0 (agent): Copyright (c) Kevin Mårtensson <kevinmartensson@gmail.com> (github.com/kevva)
- `shebang-regex` 3.0.0 (agent): Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)
- `side-channel` 1.1.1 (agent): Copyright (c) 2019 Jordan Harband
- `side-channel-list` 1.0.1 (agent): Copyright (c) 2024 Jordan Harband
- `side-channel-map` 1.0.1 (agent): Copyright (c) 2024 Jordan Harband
- `side-channel-weakmap` 1.0.2 (agent): Copyright (c) 2019 Jordan Harband
- `statuses` 2.0.2 (agent):
  - Copyright (c) 2014 Jonathan Ong <me@jongleberry.com>
  - Copyright (c) 2016 Douglas Christopher Wilson <doug@somethingdoug.com>
- `stream-browserify` 3.0.0 (server): Copyright (c) James Halliday
- `string_decoder` 1.3.0 (server):
  - Copyright Node.js contributors. All rights reserved.
  - Copyright Joyent, Inc. and other Node contributors. All rights reserved.
- `toidentifier` 1.0.1 (agent): Copyright (c) 2016 Douglas Christopher Wilson <doug@somethingdoug.com>
- `type-is` 2.1.0 (agent):
  - Copyright (c) 2014 Jonathan Ong <me@jongleberry.com>
  - Copyright (c) 2014-2015 Douglas Christopher Wilson <doug@somethingdoug.com>
- `unpipe` 1.0.0 (agent): Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
- `util-deprecate` 1.0.2 (server): Copyright (c) 2014 Nathan Rajlich <nathan@tootallnate.net>
- `vary` 1.1.2 (agent): Copyright (c) 2014-2017 Douglas Christopher Wilson
- `xtend` 4.0.2 (server): Copyright (c) 2012-2014 Raynos.
- `zod` 4.6.7 (server, agent, web but not bundled): Copyright (c) 2025 Colin McDonnell

### ISC

- `inherits` 2.0.4 (server, agent): Copyright (c) Isaac Z. Schlueter
- `isexe` 2.0.0 (agent): Copyright (c) Isaac Z. Schlueter and Contributors
- `once` 1.4.0 (agent): Copyright (c) Isaac Z. Schlueter and Contributors
- `pg-int8` 1.0.1 (server): Copyright © 2017, Charmander <~@charmander.me>
- `semver` 7.8.5 (server): Copyright (c) Isaac Z. Schlueter and Contributors
- `setprototypeof` 1.2.0 (agent): Copyright (c) 2015, Wes Todd
- `split2` 4.2.0 (server): Copyright (c) 2014-2018, Matteo Collina <hello@matteocollina.com>
- `which` 2.0.2 (agent): Copyright (c) Isaac Z. Schlueter and Contributors
- `wrappy` 1.0.2 (agent): Copyright (c) Isaac Z. Schlueter and Contributors
- `zod-to-json-schema` 3.25.2 (agent): Copyright (c) 2020, Stefan Terdell

### BSD-3-Clause

- `fast-uri` 3.1.9 (agent):
  - Copyright (c) 2011-2021, Gary Court until https://github.com/garycourt/uri-js/commit/a1acf730b4bba3f1097c9f52e7d9d3aba8cdcaae
  - Copyright (c) 2021-present The Fastify team <https://github.com/fastify/fastify#team>
- `ieee754` 1.2.1 (server): Copyright 2008 Fair Oaks Labs, Inc.
- `qs` 6.17.1 (agent): Copyright (c) 2014, Nathan LaFreniere and other [contributors](https://github.com/ljharb/qs/graphs/contributors)

### BSD-2-Clause

- `json-schema-typed` 8.0.2 (agent):
  - Original source code is copyright (c) 2019-2025 Remy Rylan <https://github.com/RemyRylan>
  - The JSON Schema documentation and descriptions are copyright (c) the IETF Trust and the authors of each JSON Schema draft from 2009 to 2020, as its LICENSE.md lists them

### 0BSD

- `tslib` 2.8.1 (server, web but not bundled): Copyright (c) Microsoft Corporation.

### Apache-2.0

- `@aws-sdk/checksums` 3.1001.1 (server): Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/client-s3` 3.1148.0 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/core` 3.978.1 (server): Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/credential-provider-env` 3.972.72 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/credential-provider-http` 3.972.74 (server): No license file in the package; its package.json names the AWS SDK for JavaScript Team as author
- `@aws-sdk/credential-provider-ini` 3.973.17 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/credential-provider-login` 3.972.79 (server): No license file in the package; its package.json names the AWS SDK for JavaScript Team as author
- `@aws-sdk/credential-provider-node` 3.972.84 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/credential-provider-process` 3.972.72 (server): Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/credential-provider-sso` 3.973.16 (server): Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/credential-provider-web-identity` 3.972.78 (server): Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/lib-storage` 3.1148.0 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/middleware-sdk-s3` 3.972.77 (server): Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/nested-clients` 3.997.46 (server): No license file in the package; its package.json names the AWS SDK for JavaScript Team as author
- `@aws-sdk/signature-v4-multi-region` 3.996.47 (server): Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/token-providers` 3.1138.0 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/types` 3.974.6 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws-sdk/xml-builder` 3.972.41 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@aws/lambda-invoke-store` 0.3.0 (server): Its LICENSE has no copyright line; its package.json names Amazon Web Services as author
- `@smithy/core` 3.35.2 (server): Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@smithy/credential-provider-imds` 4.5.2 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@smithy/fetch-http-handler` 5.8.0 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@smithy/node-http-handler` 4.12.1 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@smithy/signature-v4` 5.7.4 (server): Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `@smithy/types` 4.19.0 (server): Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
- `detect-libc` 2.1.2 (server): Copyright 2017 Lovell Fuller and others.
- `sharp` 0.35.5 (server): Copyright 2013 Lovell Fuller and others.

## License texts

These are the standard texts. A few packages word theirs slightly differently; each package's own license file has its exact text. The copyright lines that go with them are in the lists above.

### MIT License

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### ISC License

```text
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### BSD 3-Clause License

```text
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### BSD 2-Clause License

```text
Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### Zero-Clause BSD (0BSD)

```text
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

### Apache License 2.0

The full text is at https://www.apache.org/licenses/LICENSE-2.0. Most Apache-2.0 packages above also include it in their LICENSE file. None of them has a NOTICE file.

### SIL Open Font License 1.1

```text
-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

### GNU Lesser General Public License 3.0

The full text is at https://www.gnu.org/licenses/lgpl-3.0.html. It adds to the GNU General Public License 3.0, at https://www.gnu.org/licenses/gpl-3.0.html.
