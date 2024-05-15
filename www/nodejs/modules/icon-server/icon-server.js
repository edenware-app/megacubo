import Download from '../download/download.js'
import { decodeURIComponentSafe,prepareCORS, sanitize } from '../utils/utils.js';
import osd from '../osd/osd.js'
import menu from '../menu/menu.js'
import storage from '../storage/storage.js'
import crypto from 'crypto';
import lists from '../lists/lists.js';
import fs from 'fs';
import jimp from '../jimp-worker/main.js';
import crashlog from '../crashlog/crashlog.js';
import paths from '../paths/paths.js';
import path from 'path';
import pLimit from 'p-limit';
import Icon from './icon.js';
import http from 'http';
import Reader from '../reader/reader.js';
import closed from '../on-closed/on-closed.js';
import config from '../config/config.js'
import renderer from '../bridge/bridge.js'

class IconDefault {
    constructor() {
        this.defaultIconExtension = process.platform == 'win32' ? 'ico' : 'png';
    }
    prepareDefaultName(terms) {
        if (!Array.isArray(terms)) {
            terms = lists.tools.terms(terms);
        }
        return sanitize(terms.filter(s => s.length && !s.startsWith('-')).join('-'));
    }
    getDefault(terms) {
        return new Promise((resolve, reject) => {
            if (!terms || !terms.length) {
                return resolve(false);
            }
            let name = this.prepareDefaultName(terms) + '.png', file = this.opts.folder + '/' + name;
            fs.stat(file, (err, stat) => {
                if (stat && stat.size) {
                    fs.readFile(file, { encoding: null }, (err, content) => {
                        if (err && !content) {
                            console.error(err);
                            resolve(false);
                        } else {
                            resolve(content);
                        }
                    });
                } else {
                    resolve(false);
                }
            });
        });
    }
    getDefaultFile(terms) {
        return new Promise((resolve, reject) => {
            if (!terms || !terms.length) {
                return resolve(false);
            }
            
            let name = this.prepareDefaultName(terms) + '.png', file = this.opts.folder + '/' + name;
            fs.stat(file, (err, stat) => {
                if (stat && stat.size >= 32) {
                    resolve(file);
                } else {
                    resolve(false);
                }
            });
        });
    }
    saveDefault(terms, data, cb) {
        
        const updating = !lists.loaded() || !lists.activeLists.length; // we may find a better logo after
        if (!updating && terms && terms.length) {
            let name = this.prepareDefaultName(terms) + '.png', file = this.opts.folder + '/' + name;
            if (this.opts.debug) {
                console.log('saveDefault', terms, name, file);
            }
            
            fs.writeFile(file, data, 'binary', () => {
                if (cb) {
                    cb(file);
                }
            });
        } else {
            if (cb) {
                cb(false);
            }
        }
    }
    async saveDefaultFile(terms, sourceFile) {
        
        if (!lists.loaded() || !lists.activeLists.length) { // we may find a better logo later
            return false;
        }
        if (terms && terms.length) {
            let err, name = this.prepareDefaultName(terms) + '.png', file = this.opts.folder + '/' + name;
            if (this.opts.debug) {
                console.log('saveDefaultFile', terms, name, sourceFile, file);
            }
            
            await fs.promises.stat(sourceFile).catch(e => err = e);
            if (!err)
                await fs.promises.copyFile(sourceFile, file);
        }
    }
    getDefaultIcon(terms) {
        return new Promise(resolve => {
            if (!terms || !terms.length) {
                return resolve(false);
            }
            
            let name = this.prepareDefaultName(terms) + '.icon.' + this.defaultIconExtension, file = this.opts.folder + '/' + name;
            fs.stat(file, (err, stat) => {
                if (stat && stat.size >= 32) {
                    resolve(file);
                } else {
                    resolve(false);
                }
            });
        });
    }
    async saveDefaultIcon(terms, sourceFile) {
        if (terms && terms.length) {
            let err, name = this.prepareDefaultName(terms) + '.icon.' + this.defaultIconExtension, file = this.opts.folder + '/' + name;
            if (this.opts.debug) {
                console.log('saveDefaultFile', terms, name, sourceFile, file);
            }
            
            await fs.promises.stat(sourceFile).catch(e => err = e);
            if (!err)
                await fs.promises.copyFile(sourceFile, file);
            return file;
        }
    }
    async adjust(file, options) {
        return await this.limiter.adjust(async () => {
            return await this.doAdjust(file, options);
        });
    }
    async doAdjust(file, options) {
        let opts = {
            autocrop: config.get('autocrop-logos')
        };
        if (options) {
            Object.assign(opts, options);
        }
        return await jimp.transform(file, opts);
    }
}
class IconSearch extends IconDefault {
    constructor() {
        super();
        this.watchingIcons = {};
    }
    seemsLive(e) {        
        return (e.gid || lists.mi.isLive(e.url)) ? 1 : 0; // gid here serves as a hint of a live stream
    }
    search(ntms, liveOnly) {
        if (this.opts.debug) {
            console.log('icons.search', ntms);
        }
        return new Promise((resolve, reject) => {
            if (this.opts.debug) {
                console.log('is channel', ntms);
            }
            
            let images = [];
            const next = () => {
                lists.search(ntms, {
                    type: 'live',
                    safe: !lists.parentalControl.lazyAuth()
                }).then(ret => {
                    if (this.opts.debug) {
                        console.log('fetch from terms', ntms, liveOnly, JSON.stringify(ret));
                    }
                    if (ret.results.length) {
                        const already = {}, alreadySources = {};
                        ret = ret.results.filter(e => {
                            return e.icon && e.icon.indexOf('//') != -1;
                        });
                        if (this.opts.debug) {
                            console.log('fetch from terms', JSON.stringify(ret));
                        }
                        ret = ret.map((e, i) => {
                            if (typeof (already[e.icon]) == 'undefined') {
                                already[e.icon] = i;
                                alreadySources[e.icon] = [e.source];
                                return {
                                    icon: e.icon,
                                    live: this.seemsLive(e) ? 1 : 0,
                                    hits: 1,
                                    watching: this.watchingIcons[e.icon] || 0,
                                    epg: 0
                                };
                            } else {
                                if (!alreadySources[e.icon].includes(e.source)) {
                                    alreadySources[e.icon].push(e.source);
                                    ret[already[e.icon]].hits++;
                                }
                                if (!ret[already[e.icon]].live && this.seemsLive(e)) {
                                    ret[already[e.icon]].live = true;
                                }
                            }
                        }).filter(e => !!e);
                        ret = ret.sortByProp('hits', true).sortByProp('live', true); // gid here serves as a hint of a live stream
                        if (this.opts.debug) {
                            console.log('search() result', ret);
                        }
                        images.push(...ret);
                    }
                }).catch(console.error).finally(() => resolve(images));
            }
            lists.epgSearchChannelIcon(ntms).then(srcs => images = srcs.map(src => {
                return { icon: src, live: true, hits: 1, watching: 1, epg: 1 };
            })).catch(console.error).finally(next)
        });
    }
}
class IconServerStore extends IconSearch {
    constructor() {
        super();
        this.ttlHTTPCache = 24 * 3600;
        this.ttlBadHTTPCache = 1800;
    }
    key(url) {
        return crypto.createHash('md5').update(url).digest('hex');
    }
    isHashKey(key) {
        return key.length == 32 && key.indexOf(',') == -1;
    }
    file(url, isKey) {
        return this.opts.folder + '/logo-' + (isKey === true ? url : this.key(url)) + '.cache';
    }
    validate(content) {
        if (content && content.length > 25) {
            const jsign = content.readUInt16BE(0);
            if (jsign === 0xFFD8) {
                return 1; // is JPEG
            } else {
                const gsign = content.toString('ascii', 0, 3);
                if (gsign === 'GIF') {
                    if (content.length > (512 * 1024)) { // 512kb
                        return 0; // avoid huge GIFs
                    } else {
                        return 1;
                    }
                }
            }
            const magic = content.toString('hex', 0, 4);
            if (magic === '89504e47') {
                const chunkType = content.toString('ascii', 12, 16);
                if (chunkType === 'IHDR') {
                    const colorType = content.readUInt8(25);
                    const hasAlpha = (colorType & 0x04) !== 0;
                    if (hasAlpha) {
                        return 2; // valid, has alpha
                    }
                }
                return 1;
            } else {
                console.error('BAD MAGIC', magic, content);
            }
        }
    }
    validateFile(file) {
        return new Promise((resolve, reject) => {
            
            fs.access(file, fs.constants.R_OK, err => {
                if (err)
                    return reject(err);
                fs.open(file, 'r', (err, fd) => {
                    if (err)
                        return reject(err);
                    const readSize = 32;
                    fs.read(fd, Buffer.alloc(readSize), 0, readSize, 0, (err, bytesRead, content) => {
                        if (err)
                            return reject(err);
                        let v = this.validate(content);
                        if (v) {
                            resolve(v);
                        } else {
                            reject('file not validated');
                        }
                    });
                });
            });
        });
    }
    resolveHTTPCache(key) {
        return storage.resolve('icons-cache-' + key);
    }
    async checkHTTPCache(key) {
        const has = await storage.exists('icons-cache-' + key);
        if (has !== false) {
            return this.resolveHTTPCache(key);
        }
        throw 'no http cache';
    }
    async getHTTPCache(key) {
        const data = await storage.get('icons-cache-' + key);
        if (data) {
            return { data };
        }
        throw 'no cache*';
    }
    async saveHTTPCache(key, data) {
        if (!cb)
            cb = () => {};
        const ttl = data && data.length ? this.ttlHTTPCache : this.ttlBadHTTPCache;
        await storage.set('icons-cache-' + key, data, { raw: true, ttl });
    }
    async saveHTTPCacheExpiration(key, size) {
        let stat;
        const file = storage.resolve('icons-cache-' + key);
        if (typeof (size) != 'number') {
            let err;
            
            stat = await fs.promises.stat(file).catch(e => err = e);
            err || (size = stat.size);
        }
        let time = this.ttlBadHTTPCache;
        if (stat && stat.size) {
            time = this.ttlHTTPCache;
        }
        storage.setTTL('icons-cache-' + key, time);
    }
    async fetchURL(url) {
        const suffix = 'data:image/png;base64,';
        if (String(url).startsWith(suffix)) {
            
            const key = this.key(url);
            const file = this.resolveHTTPCache(key);
            await fs.promises.writeFile(file, Buffer.from(url.substr(suffix.length), 'base64'));
            this.opts.debug && console.log('FETCHED ' + url + ' => ' + file);
            const ret = await this.validateFile(file);
            return { key, file, isAlpha: ret == 2 };
        }
        if (typeof (url) != 'string' || url.indexOf('//') == -1) {
            throw 'bad url ' + crashlog.stringify(url);
        }
        const key = this.key(url);
        if (this.opts.debug) {
            console.warn('WILLFETCH', url);
        }
        let err;
        const cfile = await this.checkHTTPCache(key).catch(e => err = e);
        if (!err) { // has cache
            if (this.opts.debug) {
                console.log('fetchURL', url, 'cached');
            }
            const ret = await this.validateFile(cfile).catch(e => err = e);
            if (!err) {
                return { key, file: cfile, isAlpha: ret == 2 };
            }
        }
        if (this.opts.debug) {
            console.log('fetchURL', url, 'request', err);
        }
        const file = this.resolveHTTPCache(key);
        err = null;
        await this.limiter.download(async () => {
            await Download.file({
                url,
                file,
                retries: 2,
                timeout: 10,
                downloadLimit: this.opts.downloadLimit,
                headers: {
                    'content-encoding': 'identity'
                }
            }).catch(e => err = e);
        });
        if (err) {            
            await fs.promises.unlink(file).catch(console.error);
            throw err;
        }
        await this.saveHTTPCacheExpiration(key);
        const ret2 = await this.validateFile(file);
        const atts = { key, file, isAlpha: ret2 == 2 };
        if (this.opts.debug) {
            console.log('fetchURL', url, 'validated');
        }
        return Object.assign({}, atts);
    }
}
class IconServer extends IconServerStore {
    constructor() {
        super();
        const { data } = paths;
        this.opts = {
            addr: '127.0.0.1',
            port: 0,
            downloadLimit: 1 * (1024 * 1024),
            folder: data + '/icons',
            debug: false
        };
        this.opts.folder = path.resolve(this.opts.folder);
        
        fs.access(this.opts.folder, err => {
            if (err !== null) {
                fs.mkdir(this.opts.folder, () => {});
            }
        });
        this.closed = false;
        this.server = false;
        this.limiter = {
            download: pLimit(20),
            adjust: pLimit(1)
        };
        this.rendering = {};
        this.renderingPath = null;
        this.listen();
    }
    get(e) {
        const icon = new Icon(e, this);
        const promise = icon.get();
        promise.icon = icon;
        promise.entry = e;
        promise.destroy = () => icon.destroy();
        return promise;
    }
    result(e, path, tabindex, ret) {
        if (!this.destroyed && ret.url) {
            if (this.opts.debug) {
                console.error('ICON=' + e.path + ' (' + e.name + ', ' + tabindex + ') ' + ret.url);
            }
            if (path.endsWith(e.name) && tabindex != -1) {
                path = path.substr(0, path.length - 1 - e.name.length);
            }
            renderer.get().emit('icon', {
                url: ret.url,
                path,
                tabindex,
                name: e.name,
                force: ret.force,
                alpha: ret.alpha
            });
        }
    }
    listsLoaded() {        
        return lists.loaded() && lists.activeLists.length;
    }
    debug(...args) {
        osd.show(Array.from(args).map(s => String(s)).join(', '), 'fas fa-info-circle', 'active-downloads', 'persistent');
    }
    qualifyEntry(e) {
        if (!e || (e.class && e.class.indexOf('no-icon') != -1)) {
            return false;
        }
        if (e.icon || e.programme) {
            return true;
        }
        const t = e.type || 'stream';
        if (t == 'stream' || ['entry-meta-stream', 'entry-icon'].some(c => {
            return e.class && e.class.indexOf(c) != -1;
        })) {
            return true;
        }
        if (t == 'action' && e.fa == 'fas fa-play-circle') {
            return true;
        }
    }
    addRenderTolerance(range, limit) {
        let vx = config.get('view-size-x');
        range.start = Math.max(range.start - vx, 0);
        range.end = Math.min(range.end + vx, limit);
        return range;
    }
    render(entries, path) {
        if (!config.get('show-logos'))
            return;
        let vs = config.get('view-size-x') * config.get('view-size-y'), range = {
            start: 0,
            end: vs
        };
        range = this.addRenderTolerance(range, entries.length);
        this.renderRange(range, path);
    }
    renderRange(range, path) {
        if (path == menu.path && Array.isArray(menu.pages[path])) {
            range = this.addRenderTolerance(range, menu.pages[path].length);
            if (path != this.renderingPath) {
                Object.keys(this.rendering).forEach(i => {
                    if (i != -1 && this.rendering[i]) {
                        this.rendering[i].destroy();
                        delete this.rendering[i];
                    }
                });
                this.renderingPath = path;
                menu.pages[path].slice(range.start, range.end).map((e, i) => {
                    const j = range.start + i;
                    if (this.qualifyEntry(e)) {
                        this.rendering[j] = this.get(e); // do not use then directly to avoid losing destroy method
                        this.rendering[j].icon.on('result', ret => {
                            this.result(e, e.path, j, ret);
                        });
                        this.rendering[j].catch(console.error);
                    } else {
                        this.rendering[j] = null;
                    }
                });
            } else {
                Object.keys(this.rendering).forEach(i => {
                    if (i != -1 && this.rendering[i] && (i < range.start || i > range.end)) {
                        this.rendering[i].destroy();
                        delete this.rendering[i];
                    }
                });
                menu.pages[path].slice(range.start, range.end).map((e, i) => {
                    const j = range.start + i;
                    if ((!this.rendering[j] || this.rendering[j].entry.name != e.name) && this.qualifyEntry(e)) {
                        this.rendering[j] = this.get(e); // do not use then directly to avoid losing destroy method
                        this.rendering[j].icon.on('result', ret => {
                            this.result(e, path, j, ret);
                        });
                        this.rendering[j].catch(console.error);
                    }
                });
            }
        }
    }
    listen() {
        if (!this.server) {
            if (this.server) {
                this.server.close();
            }
            this.server = http.createServer((req, response) => {
                if (this.opts.debug) {
                    console.log('req starting...', req.url);
                }
                if (req.method == 'OPTIONS' || this.closed) {
                    response.writeHead(200, prepareCORS({
                        'Content-Length': 0,
                        'Connection': 'close',
                        'Cache-Control': 'max-age=0, no-cache, no-store'
                    }, req));
                    response.end();
                    return;
                }
                let key = req.url.split('/').pop(), send = file => {
                    if (file) {
                        if (this.opts.debug) {
                            console.log('get() resolved', file);
                        }
                        response.writeHead(200, prepareCORS({
                            'Connection': 'close',
                            'Cache-Control': 'max-age=0, no-cache, no-store',
                            'Content-Type': 'image/png'
                        }, req));
                        const stream = new Reader(file);
                        stream.on('data', c => response.write(c));
                        closed(req, response, stream, () => {
                            stream.destroy();
                            response.end();
                        });
                    } else {
                        if (this.opts.debug) {
                            console.log('BADDATA', file);
                        }
                        console.error('icons.get() not validated', req.url, file);
                        response.writeHead(404, prepareCORS({
                            'Content-Length': 0,
                            'Connection': 'close',
                            'Cache-Control': 'max-age=0, no-cache, no-store'
                        }, req));
                        response.end();
                    }
                };
                if (this.opts.debug) {
                    console.log('serving', req.url, key);
                }
                const onerr = err => {
                    console.error('icons.get() catch', err, req.url);
                    if (this.opts.debug) {
                        console.log('get() catch', err, req.url);
                    }
                    response.writeHead(404, prepareCORS({
                        'Connection': 'close',
                        'Cache-Control': 'max-age=0, no-cache, no-store'
                    }, req));
                    response.end(err + ' - ' + req.url.split('#')[0]);
                };
                if (this.isHashKey(key)) {
                    this.checkHTTPCache(key).then(send).catch(onerr);
                } else {
                    this.getDefaultFile(decodeURIComponentSafe(key).split(',')).then(send).catch(onerr);
                }
            }).listen(this.opts.port, this.opts.addr, err => {
                if (err) {
                    console.error('unable to listen on port', err);
                    return;
                }
                this.opts.port = this.server.address().port;
                this.url = 'http://' + this.opts.addr + ':' + this.opts.port + '/';
            });
        }
    }
    refresh() {
        Object.values(this.rendering).forEach(r => r && r.destroy());
        this.rendering = {};
        this.render(menu.pages[menu.path], menu.path);
    }
    destroy() {
        if (this.opts.debug) {
            console.log('closing...');
        }
        this.closed = true;
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        this.removeAllListeners();
    }
}
export default new IconServer();
