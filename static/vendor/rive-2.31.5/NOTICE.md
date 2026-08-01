# @rive-app/canvas

- Version: 2.31.5
- Source: https://www.npmjs.com/package/@rive-app/canvas
- Runtime project: https://github.com/rive-app/rive-wasm
- License: MIT

The WebAssembly file is an unmodified self-hosted copy from the published npm
package. The JavaScript bundle has one local policy patch: when the self-hosted
WASM fails, it reports the failure instead of retrying jsDelivr. Article Atlas
then keeps its static water fallback.
