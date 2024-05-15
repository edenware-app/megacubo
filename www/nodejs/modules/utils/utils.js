import { rimraf, rimrafSync } from "rimraf";
import sanitizeFilename from "sanitize-filename";
import np from "../network-ip/network-ip.js";
import os from "os";
import { URL } from 'url'
import fs from 'fs'
import moment from 'moment-timezone';

if (!global.Promise.allSettled) {
    global.Promise.allSettled = ((promises) => Promise.all(promises.map(p => p
        .then(value => ({
        status: 'fulfilled', value
    }))
        .catch(reason => ({
        status: 'rejected', reason
    })))))
}
if (!global.String.prototype.format) {
    Object.defineProperty(global.String.prototype, 'format', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function () {
            var args = arguments;
            return this.replace(/{(\d+)}/g, function (match, number) {
                return typeof args[number] != 'undefined'
                    ? args[number]
                    : match;
            });
        }
    });
}
if (!global.String.prototype.matchAll) {
    Object.defineProperty(global.String.prototype, 'matchAll', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function (regexp) {
            var matches = [];
            this.replace(regexp, function () {
                var arr = ([]).slice.call(arguments, 0);
                var extras = arr.splice(-2);
                arr.index = extras[0];
                arr.input = extras[1];
                matches.push(arr);
            });
            return matches.length ? matches : [];
        }
    });
}
if (!global.Array.prototype.findLastIndex) {
    Object.defineProperty(global.Array.prototype, 'findLastIndex', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function (callback, thisArg) {
            for (let i = this.length - 1; i >= 0; i--) {
                if (callback.call(thisArg, this[i], i, this))
                    return i;
            }
            return -1;
        }
    });
}
if (!global.Array.prototype.unique) {
    Object.defineProperty(global.Array.prototype, 'unique', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function () {
            return [...new Set(this)];
        }
    });
}
if (!global.Array.prototype.sortByProp) {
    Object.defineProperty(global.Array.prototype, 'sortByProp', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function (p, reverse) {
            if (Array.isArray(this)) { // this.slice is not a function (?!)
                return this.slice(0).sort((a, b) => {
                    let ua = typeof (a[p]) == 'undefined', ub = typeof (b[p]) == 'undefined';
                    if (ua && ub)
                        return 0;
                    if (ua && !ub)
                        return reverse ? 1 : -1;
                    if (!ua && ub)
                        return reverse ? -1 : 1;
                    if (reverse)
                        return (a[p] > b[p]) ? -1 : (a[p] < b[p]) ? 1 : 0;
                    return (a[p] > b[p]) ? 1 : (a[p] < b[p]) ? -1 : 0;
                });
            }
            return this;
        }
    });
}
if (!global.Number.prototype.between) {
    Object.defineProperty(global.Number.prototype, 'between', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function (a, b) {
            var min = Math.min(a, b), max = Math.max(a, b);
            return this >= min && this <= max;
        }
    });
}
if (!global.String.prototype.replaceAll) {
    Object.defineProperty(global.String.prototype, 'replaceAll', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function (search, replacement) {
            let target = String(this);
            if (target.indexOf(search) != -1) {
                target = target.split(search).join(replacement);
            }
            return target;
        }
    });
}

export const LIST_DATA_KEY_MASK = 'list-data-1-{0}'
export const DEFAULT_ACCESS_CONTROL_ALLOW_HEADERS = 'Origin, X-Requested-With, Content-Type, Cache-Control, Accept, Content-Range, Range, Vary, range, Authorization';
export const forwardSlashes = path => {
    if (path && path.indexOf('\\') != -1) {
        return path.replaceAll('\\', '/').replaceAll('//', '/');
    }
    return path;
}
export const getDomain = (u, includePort) => {
    let d = u;
    if (u && u.indexOf('//') != -1) {
        d = u.split('//')[1].split('/')[0];
    }
    if (d.indexOf('@') != -1) {
        d = d.split('@')[1];
    }
    if (d.indexOf(':') != -1 && !includePort) {
        d = d.split(':')[0];
    }
    return d;
}
export const trimExt = (text, exts) => {
    if (typeof (exts) == 'string') {
        exts = [exts];
    }
    exts.some(e => {
        if (text.endsWith('.' + e)) {
            text = text.substr(0, text.length - (e.length + 1));
            return true;
        }
    });
    return text;
}
export const basename = (str, rqs) => {
    str = String(str);
    let qs = '', pos = str.indexOf('?')
    if (pos != -1) {
        qs = str.slice(pos + 1)
        str = str.slice(0, pos)
    }
    str = forwardSlashes(str)
    pos = str.lastIndexOf('/')
    if (pos != -1) {
        str = str.substring(pos + 1)
    }
    if (!rqs && qs) {
        str += '?' + qs
    }
    return str
}
export const ext = file => {
    let parts = basename(file, true).split('.')
    if (parts.length > 1) {
        return parts.pop().toLowerCase()
    } else {
        return ''
    }
}
export const joinPath = (folder, file) => {
    if (!file)
        return folder;
    if (!folder)
        return file;
    let ret, ffolder = folder, ffile = file;
    if (ffolder.indexOf('\\') != -1) {
        ffolder = forwardSlashes(ffolder);
    }
    if (ffile.indexOf('\\') != -1) {
        ffile = forwardSlashes(ffile);
    }
    let folderEndsWithSlash = ffolder.charAt(ffolder.length - 1) == '/';
    let fileStartsWithSlash = ffile.startsWith('/');
    if (fileStartsWithSlash && folderEndsWithSlash) {
        ret = ffolder + ffile.substr(1);
    } else if (fileStartsWithSlash || folderEndsWithSlash) {
        ret = ffolder + ffile;
    } else {
        ret = ffolder + '/' + ffile;
    }
    return ret
}
export const decodeURIComponentSafe = uri => {
    try {
        return decodeURIComponent(uri);
    }
    catch (e) {
        return uri.replace(new RegExp('%[A-Z0-9]{0,2}', 'gi'), x => {
            try {
                return decodeURIComponent(x);
            }
            catch (e) {
                return x;
            }
        });
    }
}
export const moveFileInternal = async (from, to) => {
    const fstat = await fs.promises.stat(from).catch(console.error);
    if (!fstat)
        throw '"from" file not found';
    let err;
    await fs.promises.rename(from, to).catch(e => err = e);
    if (err) {
        let err;
        await fs.promises.copyFile(from, to).catch(e => err = e);
        if (typeof (err) != 'undefined') {
            const tstat = await fs.promises.stat(to).catch(console.error);
            if (tstat && tstat.size == fstat.size)
                err = null;
        }
        if (err)
            throw err;
        await fs.promises.unlink(from).catch(() => {});
    }
    return true;
}
export const moveFile = (from, to, _cb, timeout = 5, until = null, startedAt = null, fromSize = null) => {
    const now = (Date.now() / 1000), cb = err => {
        if (_cb) {
            _cb(err);
            _cb = null;
        }
    }
    if (until === null) {
        until = now + timeout;
    }
    if (startedAt === null) {
        startedAt = now;
    }
    const move = () => {
        moveFileInternal(from, to).then(() => cb()).catch(err => {
            if (until <= now) {
                fs.access(from, (aerr, stat) => {
                    console.error('MOVERETRY GAVEUP AFTER ' + (now - startedAt) + ' SECONDS', err, fromSize, aerr);
                    return cb(err);
                });
                return;
            }
            fs.stat(to, (ferr, stat) => {
                if (stat && stat.size == fromSize) {
                    cb();
                } else {
                    fs.stat(from, (err, stat) => {
                        if (stat && stat.size == fromSize) {
                            setTimeout(() => {
                                moveFile(from, to, cb, timeout, until, startedAt, fromSize);
                            }, 500);
                        } else {
                            console.error('MOVERETRY FROM FILE WHICH DOESNT EXISTS ANYMORE', err, stat);
                            console.error(ferr, err);
                            cb(err || '"from" file changed');
                        }
                    });
                }
            });
        });
    }
    if (fromSize === null) {
        fs.stat(from, (err, stat) => {
            if (err) {
                console.error('MOVERETRY FROM FILE WHICH NEVER EXISTED', err);
                cb(err);
            } else {
                fromSize = stat.size;
                move();
            }
        });
    } else {
        move();
    }
}
const insertEntryLookup = (e, term) => {
    if (Array.isArray(term)) {
        return term.some(t => insertEntryLookup(e, t));
    } else {
        return e.name == term || e.hookId == term;
    }
}
export const insertEntry = (entry, entries, preferredPosition = -1, before, after) => {
    const prop = 'name';
    const i = entries.findIndex(e => e[prop] == entry[prop]);
    if (i >= 0)
        entries.splice(i, 1); // is already present
    if (preferredPosition < 0)
        preferredPosition = Math.max(0, entries.length - preferredPosition)
    if (before) {
        const n = entries.findIndex(e => insertEntryLookup(e, before))
        if (n >= 0)
            preferredPosition = n;
    }
    if (after) {
        const n = entries.findLastIndex(e => insertEntryLookup(e, after))
        if (n >= 0)
            preferredPosition = n + 1;
    }
    entries.splice(preferredPosition, 0, entry);
}
export const validateURL = url => {
    if (url && url.length > 11) {
        const parts = url.match(new RegExp('^(https?://|//)[A-Za-z0-9_\\-\\.\\:@]{4,}', 'i'));
        return parts && parts.length;
    }
}
export const ucFirst = (str, keepCase) => {
    if (!keepCase) {
        str = str.toLowerCase();
    }
    return str.replace(/^[\u00C0-\u1FFF\u2C00-\uD7FF\w]/g, letter => {
        return letter.toUpperCase();
    });
}
export const ts2clock = time => {
    let locale = undefined, timezone = undefined;
    if (typeof (time) == 'string') {
        time = parseInt(time);
    }
    time = moment(time * 1000);
    return time.format('LT');
}
export const dirname = _path => {
    let parts = _path.replace(new RegExp('\\\\', 'g'), '/').split('/');
    parts.pop();
    return parts.join('/');
}
export const sanitize = (txt, keepAccents) => {
    let ret = txt;
    if (keepAccents !== true) {
        //ret = ret.replace(new RegExp('[^\x00-\x7F]+', 'g'), '')
        ret = ret.normalize('NFD').replace(new RegExp('[\u0300-\u036f]', 'g'), '').replace(new RegExp('[^A-Za-z0-9\\._\\- ]', 'g'), '');
    }
    return sanitizeFilename(ret);
}
if (process.platform == 'android') {
    if (np.shouldPatchNetworkInterfaces()) {
        os.networkInterfaces = () => np.networkInterfaces();
    }
}
export const prepareCORS = (headers, url, forceOrigin) => {
    let origin = typeof (forceorigin) == 'string' ? forceOrigin : '*';
    if (url) {
        if (typeof (url) != 'string') { // is req object
            if (url.headers.origin) {
                url = url.headers.origin;
            } else {
                const scheme = url.connection.encrypted ? 'https' : 'http';
                const host = url.headers.host;
                url = scheme + '://' + host + url.url;
            }
        }
        let pos = url.indexOf('//');
        if (!forceOrigin && pos != -1 && pos <= 5) {
            origin = url.split('/').slice(0, 3).join('/');
        }
    }
    if (headers.setHeader) { // response object
        headers.setHeader('access-control-allow-origin', origin);
        headers.setHeader('access-control-allow-methods', 'GET,HEAD,OPTIONS');
        headers.setHeader('access-control-allow-headers', DEFAULT_ACCESS_CONTROL_ALLOW_HEADERS);
        headers.setHeader('access-control-expose-headers', DEFAULT_ACCESS_CONTROL_ALLOW_HEADERS);
        headers.setHeader('access-control-allow-credentials', true);
    } else {
        headers['access-control-allow-origin'] = origin;
        headers['access-control-allow-methods'] = 'GET,HEAD,OPTIONS';
        headers['access-control-allow-headers'] = DEFAULT_ACCESS_CONTROL_ALLOW_HEADERS;
        headers['access-control-expose-headers'] = DEFAULT_ACCESS_CONTROL_ALLOW_HEADERS;
        headers['access-control-allow-credentials'] = true;
    }
    return headers;
}
export const isWritable = stream => {
    return (stream.writable || stream.writeable) && !stream.finished;
}
export const listNameFromURL = url => {
    if (!url)
        return 'Untitled ' + parseInt(Math.random() * 9999);
    let name, subName;
    if (url.indexOf('?') !== -1) {
        url.split('?')[1].split('&').forEach(s => {
            s = s.split('=');
            if (s.length > 1) {
                if (['name', 'dn', 'title'].includes(s[0])) {
                    if (!name || name.length < s[1].length) {
                        name = s[1];
                    }
                }
                if (['user', 'username'].includes(s[0])) {
                    if (!subName) {
                        subName = s[1];
                    }
                }
            }
        });
    }
    if (!name && url.indexOf('@') != -1) {
        const m = url.match(new RegExp('//([^:]+):[^@]+@([^/#]+)'));
        if (m) {
            name = m[2] + ' ' + m[1];
        }
    }
    if (name) {
        name = decodeURIComponentSafe(name);
        if (name.indexOf(' ') === -1 && name.indexOf('+') !== -1) {
            name = name.replaceAll('+', ' ').replaceAll('<', '').replaceAll('>', '');
        }
        return trimExt(name, ['m3u']);
    }
    if (url.indexOf('//') == -1) { // isLocal
        return trimExt(url.split('/').pop(), ['m3u']);
    } else {
        url = String(url).replace(new RegExp('^[a-z]*://', 'i'), '').split('/').filter(s => s.length);
        if (!url.length) {
            return 'Untitled ' + parseInt(Math.random() * 9999);
        } else if (url.length == 1) {
            return trimExt(url[0].split(':')[0], ['m3u']);
        } else {
            return trimExt(url[0].split('.')[0] + ' ' + (subName || url[url.length - 1]), ['m3u']);
        }
    }
}
export const parseJSON = json => {
    let ret;
    try {
        let parsed = JSON.parse(json);
        ret = parsed;
    }
    catch (e) {}
    return ret;
}
export const kbfmt = (bytes, decimals = 2) => {
    if (isNaN(bytes) || typeof (bytes) != 'number')
        return 'N/A';
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024, dm = decimals < 0 ? 0 : decimals, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
export const kbsfmt = (bytes, decimals = 1) => {
    if (isNaN(bytes) || typeof (bytes) != 'number')
        return 'N/A';
    if (bytes === 0)
        return '0 Bytes/ps';
    const k = 1024, dm = decimals < 0 ? 0 : decimals, sizes = ['Bytes/ps', 'KBps', 'MBps', 'GBps', 'TBps', 'PBps', 'EBps', 'ZBps', 'YBps'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
export const absolutize = (path, url) => {
    if (!path)
        return url;
    if (!url)
        return path;
    if (path.startsWith('//')) {
        path = 'http:' + path;
    }
    if (path.match(new RegExp('^[htps:]?//'))) {
        return path;
    }
    let uri;
    try {
        uri = new URL(path, url)
        return uri.href
    } catch (e) {
        return joinPath(url, path)
    }
}
export const ucWords = (str, force) => {
    if (!force && str != str.toLowerCase()) {
        return str;
    }
    return str.replace(new RegExp('(^|[ ])[A-zÀ-ú]', 'g'), letra => {
        return letra.toUpperCase();
    });
}
export const rmdir = async (folder, itself) => {
    if(!folder) return
    let dir = forwardSlashes(folder)
    if (dir.charAt(dir.length - 1) == '/') {
        dir = dir.substr(0, dir.length - 1)
    }
    let err
    await fs.promises.access(dir).catch(e => err = e)
    if(!err) {
        console.log('rimraf', {dir})
        await rimraf(dir, {}).catch(console.error)
    }
    if (!itself) {
        await fs.promises.mkdir(dir)
    }
}
export const rmdirSync = (folder, itself) => {
    if(!folder) return
    let dir = forwardSlashes(folder)
    if (dir.charAt(dir.length - 1) == '/') {
        dir = dir.substr(0, dir.length - 1)
    }
    try {
        fs.existsSync(dir) && rimrafSync(dir)
    } catch (e) {
        console.error(e)
    }
    if(!itself) {
        try {
            fs.mkdirSync(dir, {recursive: true})
        } catch(e) {}
    }
}
export const time = dt => {
    if(dt){
        if(typeof(dt) == 'number') {
            return dt
        } else if(typeof(dt) == 'string') {
            return parseInt(dt)
        }
    } else {
        dt = new Date()
    }
    return parseInt(dt.getTime() / 1000)
}
export const kfmt = (num, digits) => {
    var si = [
        { value: 1, symbol: "" },
        { value: 1E3, symbol: "K" },
        { value: 1E6, symbol: "M" },
        { value: 1E9, symbol: "G" },
        { value: 1E12, symbol: "T" },
        { value: 1E15, symbol: "P" },
        { value: 1E18, symbol: "E" }
    ];
    var i, rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
    for (i = si.length - 1; i > 0; i--) {
        if (num >= si[i].value) {
            break;
        }
    }
    return (num / si[i].value).toFixed(digits).replace(rx, "$1") + si[i].symbol;
}
export const currentTime = () => {
    return Date.now() / 1000
}
export const traceback = () => {
    try { 
        const a = {}
        a.debug()
    } catch(ex) {
        const piece = 'is not a function'
        return ex.stack.split(piece).slice(1).join(piece).trim()
    }
}
export const deepClone = (from, allowNonSerializable) => {
    if (from == null || typeof from != "object")
        return from;
    if (from.constructor != Object && from.constructor != Array)
        return from;
    if (from.constructor == Date || from.constructor == RegExp || from.constructor == Function ||
        from.constructor == String || from.constructor == Number || from.constructor == Boolean)
        return new from.constructor(from);
    let to = new from.constructor();
    for (var name in from) {
        if (allowNonSerializable || ['string', 'object', 'number', 'boolean'].includes(typeof (from[name]))) {
            to[name] = typeof to[name] == "undefined" ? deepClone(from[name], allowNonSerializable) : to[name];
        }
    }
    return to;
}

const SYNC_BYTE = 0x47
const PACKET_SIZE = 188
export const isPacketized = sample => {
    return Buffer.isBuffer(sample) && sample.length >= PACKET_SIZE && sample[0] == SYNC_BYTE && sample[PACKET_SIZE] == SYNC_BYTE
}