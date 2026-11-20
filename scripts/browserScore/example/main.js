// SPDX-License-Identifier: GPL-3.0-only
import { createScoreLibrary, createSvgArchive } from '/browser.js';

const picker = document.querySelector('#file');
const closeButton = document.querySelector('#close');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const metadata = document.querySelector('#metadata');
const warnings = document.querySelector('#warnings');
const refreshParts = document.querySelector('#refresh-parts');
const prepareParts = document.querySelector('#prepare-parts');
const partsStatus = document.querySelector('#parts-status');
const partsCoverage = document.querySelector('#parts-coverage');
const partsWarnings = document.querySelector('#parts-warnings');
const partsList = document.querySelector('#parts-list');
const render = document.querySelector('#render');
const exportStatus = document.querySelector('#export-status');
const exportsList = document.querySelector('#exports');
const archive = document.querySelector('#archive');
const dialog = document.querySelector('#preview-dialog');
const preview = document.querySelector('#preview');
const exportMusicXml = document.querySelector('#export-musicxml');
const musicXmlStatus = document.querySelector('#musicxml-status');
const musicXmlWarnings = document.querySelector('#musicxml-warnings');
const musicXmlParts = document.querySelector('#musicxml-parts');
const musicXmlDownload = document.querySelector('#musicxml-download');
let musicXmlUrl;
let urls = [];
let library;
let session;
let catalog;

function showParts(value) {
    catalog = value;
    partsCoverage.textContent = `Parts: ${value.parts.length}. Revision: ${value.revision}. Instrument coverage: ${value.coverage}.`;
    partsWarnings.replaceChildren();
    for (const warning of value.warnings) {
        const item = document.createElement('li');
        item.textContent = warning.message;
        partsWarnings.append(item);
    }
    partsList.replaceChildren();
    for (const part of value.parts) {
        const item = document.createElement('li');
        const instruments = part.instrumentNames.length ? part.instrumentNames.join(', ') : 'unknown';
        const staves = part.staffCount === null ? 'unknown' : String(part.staffCount);
        item.textContent = `${part.name} — ${part.origin}; instruments: ${instruments}; staves: ${staves}`;
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.value = part.id; checkbox.checked = true;
        label.append(checkbox, document.createTextNode(' Select for rendering'));
        item.append(label);
        partsList.append(item);
    }
    partsStatus.dataset.state = 'success';
    partsStatus.textContent = value.parts.length ? 'Part catalog loaded.' : 'No linked parts found.';
}

async function updateParts(prepare = false) {
    render.disabled = refreshParts.disabled = prepareParts.disabled = exportMusicXml.disabled = closeButton.disabled = picker.disabled = true;
    partsStatus.dataset.state = 'loading';
    partsStatus.textContent = prepare ? 'Preparing parts…' : 'Loading parts…';
    try {
        const value = prepare
            ? await session.prepareParts({ policy: 'preserveExistingOrGenerateIfNone', expectedRevision: catalog.revision })
            : await session.listParts();
        clearExports();
        clearMusicXml();
        showParts(value);
    } catch (error) {
        partsStatus.dataset.state = 'error';
        partsStatus.textContent = 'Parts operation failed: ' + [error.code, error.message].filter(Boolean).join(': ');
    } finally {
        refreshParts.disabled = closeButton.disabled = picker.disabled = false;
        prepareParts.disabled = exportMusicXml.disabled = !catalog;
        render.disabled = !catalog;
    }
}

function clearExports() {
    if (dialog.open) dialog.close();
    preview.removeAttribute('src');
    exportsList.replaceChildren();
    archive.replaceChildren();
    for (const url of urls) URL.revokeObjectURL(url);
    urls = [];
    exportStatus.textContent = '';
    exportStatus.dataset.state = '';
}

function clearMusicXml() {
    if (musicXmlUrl) URL.revokeObjectURL(musicXmlUrl);
    musicXmlUrl = undefined;
    musicXmlStatus.textContent = '';
    musicXmlStatus.dataset.state = '';
    musicXmlWarnings.replaceChildren();
    musicXmlParts.querySelector('tbody').replaceChildren();
    musicXmlParts.hidden = true;
    musicXmlDownload.replaceChildren();
}

const musicXmlExplanations = {
    MUSICXML_FROM_FULL_SCORE: 'This file has saved parts. The MusicXML is built from the full score: notes and instruments are included, but part-only layout such as breaks and spacing is not.',
    MUSICXML_FIDELITY_UNVERIFIED: 'Exported by the MuseScore 4.0 engine. Equivalence with desktop MuseScore has not been verified for this file.',
    PART_MAPPING_INCOMPLETE: 'Some listed parts could not be matched to exactly one MusicXML part.'
};

async function closeScore() {
    clearExports();
    clearMusicXml();
    await library?.dispose();
    library = undefined;
    session = undefined;
    catalog = undefined;
    partsStatus.textContent = '';
    partsCoverage.textContent = '';
    partsWarnings.replaceChildren();
    partsList.replaceChildren();
    closeButton.disabled = true;
    result.hidden = true;
    metadata.replaceChildren();
    warnings.replaceChildren();
    document.querySelector('#details').textContent = '';
}

function field(label, value) {
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    metadata.append(term, description);
}

picker.addEventListener('change', async () => {
    const file = picker.files[0];
    if (!file) return;
    picker.disabled = true;
    closeButton.disabled = true;
    status.dataset.state = 'loading';
    status.textContent = 'Checking and importing the file…';
    try {
        await closeScore();
        const extension = file.name.split('.').pop().toLowerCase();
        if (!['mscx', 'mscz'].includes(extension)) {
            throw new Error('Choose an MSCX or MSCZ file.');
        }
        library = await createScoreLibrary({
            adapter: 'webmscore-1.2.1',
            execution: 'worker',
            assets: {
                manifestUrl: new URL('/browser-score/manifest.json', location.href),
                workerUrl: new URL('/browser-score/worker.js', location.href)
            }
        });
        session = await library.open({
            bytes: new Uint8Array(await file.arrayBuffer()),
            format: extension,
            name: file.name
        }, { compatibility: 'allowUnverified', songbook: { number: document.querySelector('#song-number').value.trim() } });
        field('File', file.name);
        field('Size', file.size.toLocaleString() + ' bytes');
        field('Format', extension.toUpperCase());
        field('File version', session.importInfo.fileVersion);
        field('Import', 'Successful');
        field('Full fidelity', 'Not yet verified');
        const explanations = {
            UNVERIFIED_INPUT: 'Full compatibility with this file version has not been certified. Import succeeded; notation and layout still need review.',
            KEY_SIGNATURES_CONVERTED: 'This file uses a newer key-signature format. Key signatures were converted so the MuseScore 4.0 engine reads them correctly.',
            RESOURCE_DIAGNOSTICS_LIMITED: 'The importer cannot detect every font substitution or unsupported feature. This notice does not mean a missing resource was found.'
        };
        for (const warning of session.importInfo.warnings) {
            const item = document.createElement('li');
            item.textContent = explanations[warning.code] || warning.message;
            warnings.append(item);
        }
        document.querySelector('#details').textContent = JSON.stringify(session.importInfo, null, 2);
        showParts(await session.listParts());
        result.hidden = false;
        status.dataset.state = 'success';
        status.textContent = 'Import successful. No import errors were detected. Full notation and layout fidelity is not yet verified.';
        closeButton.disabled = false;
    } catch (error) {
        await closeScore();
        status.dataset.state = 'error';
        status.textContent = 'Import failed: ' + [error.code, error.message].filter(Boolean).join(': ');
    } finally {
        picker.disabled = false;
        picker.value = '';
    }
});

closeButton.addEventListener('click', async () => {
    await closeScore();
    status.dataset.state = '';
    status.textContent = 'Score closed. Choose another file.';
});

exportMusicXml.addEventListener('click', async () => {
    clearMusicXml();
    render.disabled = refreshParts.disabled = prepareParts.disabled = exportMusicXml.disabled = closeButton.disabled = picker.disabled = true;
    musicXmlStatus.dataset.state = 'loading';
    musicXmlStatus.textContent = 'Exporting MusicXML…';
    try {
        const result = await session.exportMusicXml({ expectedRevision: catalog.revision });
        const body = musicXmlParts.querySelector('tbody');
        for (const part of result.parts) {
            const row = document.createElement('tr');
            const transposition = part.transposeChromatic === null ? 'none'
                : `${part.transposeChromatic > 0 ? '+' : ''}${part.transposeChromatic} semitones`;
            for (const value of [part.id, part.name || '—', part.instrumentNames.join(', ') || '—', transposition, part.catalogPart?.name ?? 'not matched']) {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            body.append(row);
        }
        musicXmlParts.hidden = false;
        for (const warning of result.warnings) {
            const item = document.createElement('li');
            item.textContent = musicXmlExplanations[warning.code] || warning.message;
            musicXmlWarnings.append(item);
        }
        musicXmlUrl = URL.createObjectURL(new Blob([result.musicXml], { type: 'application/vnd.recordare.musicxml+xml' }));
        const link = document.createElement('a');
        link.href = musicXmlUrl;
        link.download = result.filename;
        link.textContent = `Download ${result.filename}`;
        musicXmlDownload.append(link);
        musicXmlStatus.dataset.state = 'success';
        musicXmlStatus.textContent = `MusicXML exported with ${result.parts.length} instrument parts.`;
    } catch (error) {
        musicXmlStatus.dataset.state = 'error';
        musicXmlStatus.textContent = 'MusicXML export failed: ' + [error.code, error.message].filter(Boolean).join(': ');
    } finally {
        render.disabled = refreshParts.disabled = prepareParts.disabled = exportMusicXml.disabled = closeButton.disabled = picker.disabled = false;
    }
});
refreshParts.addEventListener('click', () => updateParts());
prepareParts.addEventListener('click', () => updateParts(true));
document.querySelector('#select-all').addEventListener('click', () => {
    for (const checkbox of partsList.querySelectorAll('input')) checkbox.checked = true;
});
document.querySelector('#select-none').addEventListener('click', () => {
    for (const checkbox of partsList.querySelectorAll('input')) checkbox.checked = false;
});
render.addEventListener('click', async () => {
    clearExports();
    const selected = [...partsList.querySelectorAll('input:checked')].map(input => input.value);
    if (!selected.length) { exportStatus.dataset.state = 'error'; exportStatus.textContent = 'Select at least one part.'; return; }
    render.disabled = refreshParts.disabled = prepareParts.disabled = exportMusicXml.disabled = closeButton.disabled = picker.disabled = true;
    exportStatus.dataset.state = 'loading'; exportStatus.textContent = 'Rendering pages…';
    let count = 0;
    const rendered = [];
    try {
        for (const partId of selected) {
            const part = catalog.parts.find(part => part.id === partId);
            const view = { kind: 'part', partId };
            const pages = await session.getPages(view);
            if (pages.revision !== catalog.revision) throw new Error('Score revision changed; refresh the parts and retry.');
            if (!pages.pageCount) throw new Error('A selected part has no pages.');
            for (let pageNumber = 1; pageNumber <= pages.pageCount; pageNumber++) {
                const page = await session.renderPage(view, pageNumber, { expectedRevision: catalog.revision, background: 'white' });
                rendered.push(page);
                const url = URL.createObjectURL(new Blob([page.svg], { type: 'image/svg+xml' })); urls.push(url);
                const item = document.createElement('li');
                const description = document.createElement('strong');
                description.className = 'page-label';
                description.textContent = `${part.name} · Page ${pageNumber} of ${page.pageCount} · ${page.widthMm.toFixed(1)} × ${page.heightMm.toFixed(1)} mm`;
                const link = document.createElement('a'); link.href = url; link.download = page.filename; link.textContent = page.filename;
                const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Preview';
                button.setAttribute('aria-label', `Preview ${part.name}, page ${pageNumber}`);
                button.addEventListener('click', () => { preview.src = url; preview.alt = `${part.name}, page ${pageNumber} of ${page.pageCount}`; document.querySelector('#preview-title').textContent = description.textContent; dialog.showModal(); });
                item.append(description, link, ' ', button); exportsList.append(item); count++;
            }
        }
        exportStatus.dataset.state = 'success';
        const bytes = createSvgArchive(rendered);
        const zipUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' })); urls.push(zipUrl);
        const download = document.createElement('a'); download.href = zipUrl; download.download = rendered[0].filename.split('--part-')[0] + '--part-pages.zip';
        download.textContent = 'Download all rendered pages as ZIP'; archive.append(download);
        exportStatus.textContent = `${count} pages rendered for ${selected.length} selected parts. Drawn by Verovio from the full-score MusicXML; SVG resources are self-contained. Review the previews: engraving differs from MuseScore.`;
    } catch (error) {
        exportStatus.dataset.state = 'error';
        exportStatus.textContent = `Partial output: ${count} pages rendered. Rendering failed: ` + [error.code, error.message].filter(Boolean).join(': ');
    } finally { render.disabled = refreshParts.disabled = prepareParts.disabled = exportMusicXml.disabled = closeButton.disabled = picker.disabled = false; }
});
