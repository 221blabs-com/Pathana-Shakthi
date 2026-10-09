// The mascot and the learning tree are dotLottie animations. Their player
// downloads its engine (dotlottie-player.wasm, 1.2 MB) from public CDNs by
// default, which fails on a weak school connection and offline. Serve the
// copy installed with the app instead (same version), so the service worker
// keeps it with the app shell.
import { setWasmUrl } from '@lottiefiles/dotlottie-react';
import wasmUrl from '../../node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm?url';

setWasmUrl(wasmUrl);
