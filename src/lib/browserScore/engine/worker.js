// SPDX-License-Identifier: GPL-3.0-only
// The port expects window even in a worker. navigator is already provided by
// WorkerGlobalScope and is read-only in module workers.
self.window = { addEventListener() {}, location: new URL('file:///'), encodeURIComponent };
const engineReady = import('./src/index.js');

let score;
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
    queue = queue.then(async () => {
        try {
            const { default: Engine } = await engineReady;
            let result;
            switch (data.method) {
            case 'ready':
                await Engine.ready;
                await Engine.setLogLevel(0);
                break;
            case 'load':
                score = await Engine.load(...data.params);
                break;
            case 'metadata':
                await score.setExcerptId(-1);
                result = await score.metadata();
                break;
            case 'generateExcerpts':
                await score.generateExcerpts();
                break;
            case 'pages':
                await score.setExcerptId(data.params[0]);
                result = await score.npages();
                break;
            case 'svg':
                await score.setExcerptId(data.params[0]);
                result = await score.saveSvg(data.params[1], data.params[2]);
                break;
            case 'musicxml':
                await score.setExcerptId(-1);
                result = await score.saveXml();
                break;
            case 'renderMusicXml': {
                const { renderMusicXml } = await import('./renderer.js');
                result = await renderMusicXml(...data.params);
                break;
            }
            case 'renderSheet': {
                const { renderSheet } = await import('./renderer.js');
                result = await renderSheet(...data.params);
                break;
            }
            case 'destroy':
                score?.destroy();
                score = undefined;
                break;
            default:
                throw new Error('Unsupported operation');
            }
            self.postMessage({ id: data.id, result });
        } catch {
            self.postMessage({ id: data.id, error: true });
        }
    });
};
