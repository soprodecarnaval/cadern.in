/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any --
   fast-xml-parser returns untyped trees; every field read is validated at run time. */
// SPDX-License-Identifier: GPL-3.0-only
import { Inflate, zipSync } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { ScoreError, hasOwn, type Format, type Limits, type Warning } from './types';

export const defaultLimits: Limits = {
    inputBytes: 32 * 1024 * 1024,
    expandedBytes: 128 * 1024 * 1024,
    archiveEntries: 4096,
    operationMs: 60000
};

function invalid(message: string): never {
    throw new ScoreError('INVALID_INPUT', 'open', message);
}

function resource(message: string): never {
    throw new ScoreError('RESOURCE_LIMIT', 'open', message);
}

function decode(bytes: Uint8Array): string {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return invalid('Expected UTF-8 XML or archive paths');
    }
}

function parse(bytes: Uint8Array): any {
    const text = decode(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) {
        invalid('Malformed XML or unsupported entity declaration');
    }
    return new XMLParser({ ignoreAttributes: false, parseAttributeValue: false }).parse(text);
}

/**
 * MuseScore 4.1+ files store a key signature as <concertKey> plus an optional
 * <actualKey> (written key, when it differs). The pinned MuseScore 4.0 engine
 * only reads the older <accidental> tag and otherwise falls back to C major.
 * Desktop 4.5.2 reads <accidental> as the written key, so write that.
 */
function downgradeKeySignatures(text: string): { text: string; changed: number } {
    let changed = 0;
    const result = text.replace(/<KeySig>[\s\S]*?<\/KeySig>/g, block => {
        const concert = /<concertKey>(-?\d+)<\/concertKey>/.exec(block);
        if (!concert || /<accidental>/.test(block)) {return block;}
        const actual = /<actualKey>(-?\d+)<\/actualKey>/.exec(block);
        changed++;
        return block.replace(/[ \t]*<actualKey>-?\d+<\/actualKey>\r?\n?/, '')
            .replace(concert[0], `<accidental>${actual ? actual[1] : concert[1]}</accidental>`);
    });
    return { text: result, changed };
}

function safePath(name: string): boolean {
    return !!name && !/^[/\\]|^[a-z]:|\\|\0|:|[?#]/i.test(name)
        && !name.split('/').some(part => part === '..' || part === '.');
}

function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

// Parse the directory, then bound ACTUAL inflation and verify CRCs. The engine
// receives a canonical archive, never the original untrusted ZIP headers.
function archive(bytes: Uint8Array, limits: Limits): Record<string, Uint8Array> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = bytes.length - 22;
    for (; end >= Math.max(0, bytes.length - 65557); end--) {
        if (view.getUint32(end, true) === 0x06054b50
            && end + 22 + view.getUint16(end + 20, true) === bytes.length) {
            break;
        }
    }
    if (end < Math.max(0, bytes.length - 65557) || bytes.length < 22) {
        invalid('Missing ZIP end directory');
    }
    const count = view.getUint16(end + 10, true);
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)
        || view.getUint16(end + 8, true) !== count || count === 65535) {
        invalid('Multi-disk and ZIP64 archives are unsupported');
    }
    if (count > limits.archiveEntries) {
        resource('Archive entry limit exceeded');
    }
    const directory = view.getUint32(end + 16, true);
    const directoryEnd = directory + view.getUint32(end + 12, true);
    if (directoryEnd !== end) {
        invalid('Invalid ZIP directory bounds');
    }
    let cursor = directory;
    let expanded = 0;
    const files: Record<string, Uint8Array> = Object.create(null);
    const ranges: [number, number][] = [];
    for (let entry = 0; entry < count; entry++) {
        if (cursor + 46 > directoryEnd || view.getUint32(cursor, true) !== 0x02014b50) {
            invalid('Invalid ZIP directory entry');
        }
        const flags = view.getUint16(cursor + 8, true);
        const method = view.getUint16(cursor + 10, true);
        const crc = view.getUint32(cursor + 16, true);
        const compressed = view.getUint32(cursor + 20, true);
        const size = view.getUint32(cursor + 24, true);
        const nameLength = view.getUint16(cursor + 28, true);
        const next = cursor + 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
        const local = view.getUint32(cursor + 42, true);
        if (next > directoryEnd || local + 30 > directory || flags & ~0x80e || ![0, 8].includes(method)
            || view.getUint16(cursor + 34, true)) {
            invalid('Unsupported or corrupt ZIP entry');
        }
        const name = decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
        if (!safePath(name) || hasOwn(files, name)) {
            invalid('Unsafe or duplicate archive path');
        }
        expanded += size;
        if (expanded > limits.expandedBytes) {
            resource('Archive expansion limit exceeded');
        }
        if (view.getUint32(local, true) !== 0x04034b50
            || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) {
            invalid('ZIP local header mismatch');
        }
        const localNameLength = view.getUint16(local + 26, true);
        const start = local + 30 + localNameLength + view.getUint16(local + 28, true);
        const finish = start + compressed;
        if (finish > directory || decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name
            || ranges.some(([a, b]) => local < b && finish > a)) {
            invalid('Invalid ZIP entry bounds');
        }
        ranges.push([local, finish]);
        const output = new Uint8Array(size);
        let written = 0;
        if (method === 0) {
            if (compressed !== size) {
                invalid('Stored ZIP size mismatch');
            }
            output.set(bytes.subarray(start, finish));
            written = size;
        } else {
            const inflater = new Inflate(chunk => {
                if (written + chunk.length > size) {
                    resource('Actual ZIP expansion exceeds declared size');
                }
                output.set(chunk, written);
                written += chunk.length;
            });
            try {
                for (let offset = start; offset < finish; offset += 256) {
                    inflater.push(bytes.subarray(offset, Math.min(offset + 256, finish)), offset + 256 >= finish);
                }
            } catch (error) {
                if (error instanceof ScoreError) {
                    throw error;
                }
                invalid('Invalid compressed ZIP entry');
            }
        }
        if (written !== size || crc32(output) !== crc) {
            invalid('ZIP size or CRC mismatch');
        }
        files[name] = output;
        cursor = next;
    }
    if (cursor !== directoryEnd) {
        invalid('ZIP directory size mismatch');
    }
    return files;
}

function inspectInput(bytes: Uint8Array, format: Format, overrides: Partial<Limits> = {}) {
    const limits = { ...defaultLimits, ...overrides };
    if (!(bytes instanceof Uint8Array) || !bytes.length) {
        invalid('Expected nonempty score bytes');
    }
    if (bytes.length > limits.inputBytes) {
        resource('Input byte limit exceeded');
    }
    let xml = bytes;
    let entryName = '';
    let files: Record<string, Uint8Array> | undefined;
    const savedPartNames: Record<string, string> = Object.create(null);
    if (format === 'mscz') {
        files = archive(bytes, limits);
        const container = files['META-INF/container.xml'];
        if (!container) {
            invalid('Missing container.xml');
        }
        const roots = parse(container).container?.rootfiles?.rootfile;
        const names = (Array.isArray(roots) ? roots : [roots])
            .filter(Boolean).map(root => root['@_full-path'])
            .filter(name => typeof name === 'string' && name.endsWith('.mscx') && !name.startsWith('Excerpts/'));
        if (names.length !== 1 || !files[names[0]]) {
            invalid('Missing or ambiguous score entry');
        }
        xml = files[names[0]];
        entryName = names[0].split('/').pop()!.replace(/\.mscx$/i, '');
        // 4.x saved parts: like desktop MscLoader, a part without its own name
        // is named by its partName meta tag. Keyed by the excerpt file name,
        // which is the title the pinned engine reports for such parts.
        for (const [path, entry] of Object.entries(files)) {
            const match = /^Excerpts\/([^/]+)\/\1\.mscx$/.exec(path);
            if (!match) {continue;}
            const tags = parse(entry).museScore?.Score?.metaTag;
            const partName = (Array.isArray(tags) ? tags : [tags])
                .find(tag => tag?.['@_name'] === 'partName')?.['#text'];
            if (typeof partName === 'string' && partName.trim()) {savedPartNames[match[1]] = partName.trim();}
        }
    } else if (format !== 'mscx') {
        throw new ScoreError('UNSUPPORTED_FORMAT', 'open', 'Expected mscx or mscz');
    }
    const doc = parse(xml);
    const version = doc.museScore?.['@_version'];
    if (typeof version !== 'string' || !/^\d+\.\d+$/.test(version)
        || !doc.museScore || !hasOwn(doc.museScore, 'Score')) {
        invalid('Missing MuseScore score/version');
    }
    // Score meta tags (title, composer, ...), as text. Songbook sheets use them for the header.
    const metaTags: Record<string, string> = Object.create(null);
    const tags = doc.museScore.Score?.metaTag;
    for (const tag of Array.isArray(tags) ? tags : [tags]) {
        const name = tag?.['@_name'], value = tag?.['#text'];
        if (typeof name === 'string' && /^[A-Za-z]+$/.test(name) && (typeof value === 'string' || typeof value === 'number')) {metaTags[name] = String(value).trim();}
    }
    const warnings: Warning[] = [];
    // A conservative resource policy: never allow the native reader to resolve
    // external paths. Text and hyperlink content are not resource requests.
    function resources(node: any): void {
        if (!node || typeof node !== 'object') {
            return;
        }
        for (const [key, value] of Object.entries(node)) {
            if (['path', 'linkPath', 'imagePath', 'soundFont'].includes(key) && typeof value === 'string' && value) {
                if (!safePath(value) || !(files?.[value] || files?.['Pictures/' + value])) {
                    throw new ScoreError('INVALID_INPUT', 'open', 'External or missing score resource');
                }
            }
            resources(value);
        }
    }
    resources(doc);
    // Engine compatibility: rewrite 4.1+ key signatures for the 4.0 reader, in
    // the score and in saved part files.
    let keySignatures = 0;
    const encoder = new TextEncoder();
    const convert = (entry: Uint8Array) => {
        const { text, changed } = downgradeKeySignatures(decode(entry));
        keySignatures += changed;
        return changed ? encoder.encode(text) : entry;
    };
    if (files) {
        for (const name of Object.keys(files)) {if (name.endsWith('.mscx')) {files[name] = convert(files[name]);}}
    } else {
        bytes = convert(bytes);
    }
    if (keySignatures) {
        warnings.push({ code: 'KEY_SIGNATURES_CONVERTED', message: `${keySignatures} key signatures in a newer file format were converted for the MuseScore 4.0 engine.` });
    }
    warnings.push({ code: 'UNVERIFIED_INPUT', message: 'Version/feature fidelity is unverified; import success does not certify preservation.' });
    warnings.push({ code: 'RESOURCE_DIAGNOSTICS_LIMITED', message: 'Missing image paths are rejected; native font substitution and unknown constructs cannot be exhaustively diagnosed.' });
    return { fileVersion: version, xml, bytes: files ? zipSync(files, { level: 0 }) : bytes, warnings, savedPartNames, metaTags, entryName };
}

export function inspect(bytes: Uint8Array, format: Format, overrides: Partial<Limits> = {}) {
    try {
        const limits = { ...defaultLimits, ...overrides };
        if (Object.values(limits).some(value => !Number.isSafeInteger(value) || value <= 0)) {
            invalid('Limits must be positive safe integers');
        }
        return inspectInput(bytes, format, overrides);
    } catch (error) {
        if (error instanceof ScoreError) {
            throw error;
        }
        return invalid('Malformed score input');
    }
}
