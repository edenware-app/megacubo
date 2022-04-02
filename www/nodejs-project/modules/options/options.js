
const Events = require('events'), fs = require('fs'), path = require('path'), async = require('async')

class Timer extends Events {
    constructor(){
        super()
        this.timerTimer = 0
        this.timerData = 0
        this.timerLabel = false
    }
    timer(){
        return new Promise((resolve, reject) => {
            let opts = [];
            [5, 15, 30, 45].forEach((m) => {
                opts.push({name: global.lang.AFTER_X_MINUTES.format(m), details: global.lang.TIMER, fa: 'fas fa-clock', type: 'group', entries: [], renderer: this.timerChooseAction.bind(this, m)});
            });
            [1, 2, 3].forEach((h) => {
                opts.push({name: global.lang.AFTER_X_HOURS.format(h), details: global.lang.TIMER, fa: 'fas fa-clock', type: 'group', entries: [], renderer: this.timerChooseAction.bind(this, h * 60)});
            })
            resolve(opts)
        })
    }
    timerEntry(){
        let details = ''
        if(this.timerData){
            details = this.timerData.action +': '+ global.moment(this.timerData.end * 1000).fromNow()
            return {
                name: global.lang.TIMER, 
                fa: 'fas fa-stopwatch',
                type: 'action', 
                details,
                action: () => {
                    clearTimeout(this.timerData['timer'])
                    this.timerData = 0
                    global.explorer.refresh()
                }
            }
        } else {
            return {
                name: global.lang.TIMER, 
                fa: 'fas fa-stopwatch',
                type: 'group', 
                renderer: this.timer.bind(this)
            }
        }
    }
    timerChooseAction(minutes){
        return new Promise((resolve, reject) => {
            var opts = [
                {name: global.lang.STOP, type: 'action', fa: 'fas fa-stop', action: () => this.timerChosen(minutes, global.lang.STOP)},
                {name: global.lang.CLOSE, type: 'action', fa: 'fas fa-times-circle', action: () => this.timerChosen(minutes, global.lang.CLOSE)}
            ]
            if(!global.cordova){
                opts.push({name: global.lang.SHUTDOWN, type: 'action', fa: 'fas fa-power-off', action: () => this.timerChosen(minutes, global.lang.SHUTDOWN)})
            }
            resolve(opts)
        })
    }
    timerChosen(minutes, action){
        let t = global.time()
        this.timerData = {minutes, action, start: t, end: t + (minutes * 60)}
        this.timerData['timer'] = setTimeout(() => {
            console.warn('TIMER ACTION', this.timerData)
            let action = this.timerData.action
            if(global.streamer.active){
                if(global.tuning){
                    global.tuning.destroy()
                }
                global.streamer.stop()
            }
            if(action != global.lang.STOP){
                let recording = global.recorder && global.recorder.active() ? global.recorder.capture : false, next = () => {
                    if(action == global.lang.CLOSE){
                        global.energy.exit()
                    } else if(action == global.lang.SHUTDOWN){
                        this.timerActionShutdown()
                        global.energy.exit()
                    }
                }
                if(recording){
                    recording.on('destroy', next)
                } else {
                    next()
                }
            }
            this.timerData = 0
        }, this.timerData.minutes * 60000)
        global.explorer.open(global.lang.TOOLS).catch(global.displayErr)
    }
    timerActionShutdown(){
        var cmd, secs = 7, exec = require("child_process").exec;
        if(process.platform === 'win32') {
            cmd = 'shutdown -s -f -t '+secs+' -c "Shutdown system in '+secs+'s"';
        } else {
            cmd = 'shutdown -h +'+secs+' "Shutdown system in '+secs+'s"';
        }
        return exec(cmd)
    }
}

class PerformanceProfiles extends Timer {
    constructor(){
        super()
        this.profiles = {
            high: {
                'animate-background': 'slow-desktop',
                'auto-testing': true,
                'autocrop-logos': true,
                'connect-timeout': 5,
                'fx-nav-intensity': 2,
                'hls-prefetch': true,
                'search-missing-logos': true,
                'show-logos': true,
                'transcoding': '1080p',
                'tuning-concurrency': 4,
                'ui-sounds': true
            },
            low: {
                'animate-background': 'none',
                'auto-testing': false,
                'autocrop-logos': false,
                'connect-timeout': 10,
                'custom-background-video': '',
                'epg': 'disabled',
                'fx-nav-intensity': 0,
                'hls-prefetch': false,
                'resume': false,
                'search-missing-logos': false,
                'show-logos': false,
                'transcoding': '',
                'tuning-concurrency': 3,
                'tuning-prefer-hls': true,
                'ui-sounds': false
            }
        }
        this.profiles.high['epg-'+ global.lang.locale] = ''
        global.ui.on('performance', ret => {
            console.log('performance-callback', ret)
            if(typeof(this.profiles[ret]) != 'undefined'){
                console.log('performance-callback set', this.profiles[ret])
                global.config.setMulti(this.profiles[ret])
                if(typeof(this.profiles[ret].epg) != 'undefined'){
                    global.updateEPGConfig(this.profiles[ret].epg)
                }
                global.theme.refresh()
            }
        })
        global.ui.on('performance-setup', ret => {
            this.performance(true)
        })
    }
    detectPerformanceMode(){
        let scores = {low: 0, high: 0}
        Object.keys(this.profiles.low).forEach(att => {
            let cur = global.config.get(att)
            if(cur == this.profiles.low[att]){
                scores.low++
            }
            if(cur == this.profiles.high[att]){
                scores.high++
            }
        })
        return scores.low > scores.high ? 'low' : 'high'
    }
    performance(setup){
        let cur = this.detectPerformanceMode()
        let txt = global.lang.PERFORMANCE_MODE_MSG.format(global.lang.FOR_SLOW_DEVICES, global.lang.COMPLETE).replaceAll("\n", "<br />")
        if(setup){
            txt += '<br /><br />'+ global.lang.OPTION_CHANGE_AT_ANYTIME.format(global.lang.OPTIONS)
        }
        global.ui.emit('dialog', [
            {template: 'question', text: global.lang.PERFORMANCE_MODE, fa: 'fas fa-tachometer-alt'},
            {template: 'message', text: txt},
            {template: 'option', id: 'low', fa: cur == 'low' ? 'fas fa-check-circle' : '', text: global.lang.FOR_SLOW_DEVICES},
            {template: 'option', id: 'high', fa: cur == 'high' ? 'fas fa-check-circle' : '', text: global.lang.COMPLETE}
        ], 'performance', cur)
    }
}

class OptionsExportImport extends PerformanceProfiles {
    constructor(){
        super()
    }
    importConfigFile(data, keysToImport, cb){
        console.log('Config file', data)
        try {
            data = JSON.parse(String(data))
            if(typeof(data) == 'object'){
                data = this.prepareImportConfigFile(data, keysToImport)
                global.config.setMulti(data)
                global.osd.show('OK', 'fas fa-check-circle', 'options', 'normal')
                global.theme.update(cb)
            } else {
                throw new Error('Not a JSON file.')
            }
        } catch(e) {
            if(typeof(cb) == 'function'){
                cb(e)
            }
            global.displayErr('Invalid file', e)
        }
    }
    prepareImportConfigFile(atts, keysToImport){
        let natts = {}
        Object.keys(atts).forEach(k => {
            if(!Array.isArray(keysToImport) || keysToImport.includes(k)){
                natts[k] = atts[k]
            }
        })
        if(natts['custom-background-image']){
            const buf = Buffer.from(natts['custom-background-image'], 'base64')
            fs.writeFileSync(global.theme.customBackgroundImagePath, buf)
            natts['custom-background-image'] = global.theme.customBackgroundImagePath
        }
        if(natts['custom-background-video']){
            const buf = Buffer.from(natts['custom-background-video'], 'base64')
            const uid = parseInt(Math.random() * 1000)
            const file = global.theme.customBackgroundVideoPath +'-'+ uid + '.mp4'
            fs.writeFileSync(file, buf)
            natts['custom-background-video'] = file
            global.theme.cleanVideoBackgrounds(file)
        }
        return natts
    }
    prepareExportConfig(atts, keysToExport){
        let natts = {}
        if(!atts){
            atts = global.config.data
        }
        Object.keys(atts).forEach(k => {
            if(!Array.isArray(keysToExport) || keysToExport.includes(k)){
                if(atts[k] != global.config.defaults[k]){
                    natts[k] = atts[k]
                }
            }
        })
        if(typeof(natts['custom-background-image']) == 'string' && natts['custom-background-image']){
            let buf = fs.readFileSync(natts['custom-background-image'])
            if(buf){
                natts['custom-background-image'] = buf.toString('base64')
            } else {
                delete natts['custom-background-image']
            }
        }
        if(typeof(natts['custom-background-video']) == 'string' && natts['custom-background-video']){
            let buf = fs.readFileSync(natts['custom-background-video'])
            if(buf){
                natts['custom-background-video'] = buf.toString('base64')
            } else {
                delete natts['custom-background-video']
            }
        }
        return natts
    }
    prepareExportConfigFile(file, atts, keysToExport, cb){
        fs.writeFile(file, JSON.stringify(this.prepareExportConfig(atts, keysToExport), null, 3), {encoding: 'utf-8'}, err => {
            cb(err, file)
        })
    }
    import(data){
        const sample = String(data.slice(0, 12))
        if(sample.charAt(0) == '{' || sample.charAt(0) == '['){ // is json?
            this.importConfigFile(data)            
            global.osd.show(global.lang.IMPORTED_FILE, 'fas fa-check-circle', 'options', 'normal')
        } else {
            const zipFile = global.paths.temp +'/temp.zip'
            fs.writeFile(zipFile, data, err => {
                if(err){
                    return global.displayErr(err)
                }
                try {
                    const AdmZip = require('adm-zip')
                    const zip = new AdmZip(zipFile), imported = {}
                    async.eachOf(zip.getEntries(), (entry, i, done) => {
                        if(entry.entryName.startsWith('config')) {
                            zip.extractEntryTo(entry, path.dirname(global.config.file), false, true)
                            imported.config = entry.getData().toString('utf8')
                        }
                        if(entry.entryName.startsWith('bookmarks')) {
                            zip.extractEntryTo(entry, global.storage.folder, false, true)
                            delete global.storage.cacheExpiration[global.bookmarks.key]
                            global.bookmarks.load()
                        }
                        if(entry.entryName.startsWith('history')) {
                            zip.extractEntryTo(entry, global.storage.folder, false, true)
                            delete global.storage.cacheExpiration[global.histo.key]
                            global.histo.load()
                        }                    
                        if(entry.entryName.startsWith('categories')) {
                            zip.extractEntryTo(entry, global.storage.raw.folder, false, true, path.basename(global.storage.raw.resolve(global.channels.categoriesCacheKey)))
                            delete global.storage.raw.cacheExpiration[global.channels.categoriesCacheKey]
                            global.channels.load()
                        }
                        if(entry.entryName.startsWith('icons')) {
                            try {
                                zip.extractEntryTo(entry, path.dirname(global.icons.opts.folder), true, true) // Error: ENOENT: no such file or directory, chmod 'C:\\Users\\samsung\\AppData\\Local\\Megacubo\\Data\\icons\\a&e-|-a-&-e.png'
                            } catch(e) {}
                        }
                        if(entry.entryName.startsWith('Themes')) {
                            zip.extractEntryTo(entry, path.dirname(global.theme.folder), true, true)
                        }
                        done()
                    }, () => {
                        if(imported.config) {
                            console.warn('CONFIG', imported.config)
                            global.config.reload(imported.config)
                        }
                        global.osd.show(global.lang.IMPORTED_FILE, 'fas fa-check-circle', 'options', 'normal')
                    })
                } catch(e) {
                    global.displayErr(e)
                }
            })
        }
    }
    export(cb){
        const AdmZip = require('adm-zip')
        const zip = new AdmZip(), files = []
        const add = (path, subDir) => {
            if(fs.existsSync(path)){
                if(typeof(subDir) == 'string'){
                    zip.addLocalFolder(path, subDir)
                } else {
                    zip.addLocalFile(path)
                }
            }
        }
        add(global.config.file);
        [global.bookmarks.key, global.histo.key, global.channels.categoriesCacheKey].forEach(key => {
            files.push(global.storage.resolve(key, false))
            files.push(global.storage.resolve(key, true))
        })
        files.forEach(add)
        add(global.theme.folder, 'Themes')
        add(global.icons.opts.folder, 'icons')
        zip.writeZip(global.paths.temp +'/megacubo.export.zip')
        cb(global.paths.temp +'/megacubo.export.zip')
    }
}

class Options extends OptionsExportImport {
    constructor(){
        super()
        global.ui.on('about-callback', ret => {
            console.log('about-callback', ret)
            switch(ret){
                case 'tos':
                    this.tos()
                    break
                case 'share':
                    this.share()
                    break
                case 'help':
                    this.help()
                    break
            }
        })
        global.ui.on('reset-callback', ret => {
            console.log('reset-callback', ret)
            switch(ret){
                case 'yes':
                    global.rmdir(global.paths.data, false, true)
                    global.rmdir(global.paths.temp, false, true)
                    global.energy.restart()
                    break
            }
        })
        global.ui.on('locale-callback', locale => {
            let def = global.config.get('locale') || global.lang.locale
            if(locale && (locale != def)){
                global.config.set('locale', locale)
                global.config.set('countries', [])
                global.energy.askRestart()
            }
        })
        global.ui.on('clear-cache', ret => {
            if(ret == 'yes') this.clearCache()
        })
        global.ui.on('config-import-file', data => {
            console.warn('!!! IMPORT FILE !!!', data)
            global.importFileFromClient(data).then(ret => this.import(ret)).catch(err => {
                global.displayErr(err)
            })
        })
    }
    tools(){
        return new Promise((resolve, reject) => {
            let defaultURL = ''
            global.storage.raw.get('open-url', url => {
                if(url){
                    defaultURL = url
                }
                let entries = [
                    {name: global.lang.OPEN_URL, fa: 'fas fa-link', type: 'action', action: () => {
                        global.ui.emit('prompt', global.lang.OPEN_URL, 'http://.../example.m3u8', defaultURL, 'open-url', false, 'fas fa-link')
                    }},
                    this.timerEntry()
                ]
                resolve(entries)
            })
        })
    }
    showLanguageEntriesDialog(){
        let options = [], def = global.lang.locale
        global.lang.availableLocalesMap().then(map => {
            Object.keys(map).forEach(id => {
                options.push({
                    text: map[id] || id,
                    template: 'option',
                    fa: 'fas fa-language',
                    id
                })
            })
            global.ui.emit('dialog', [
                {template: 'question', text: global.lang.LANGUAGE, fa: 'fas fa-language'}
            ].concat(options), 'locale-callback', def)
        }).catch(global.displayErr)
    }
    countriesEntries(){
        return new Promise((resolve, reject) => {
            let entries = []
            global.lang.getCountriesMap(global.config.get('locale') || global.lang.locale).then(map => {
                let actives = global.config.get('countries') || []
                if(typeof(this.countriesEntriesOriginalActives) == 'undefined'){
                    this.countriesEntriesOriginalActives = actives.slice(0)
                }
                entries.push({
                    name: global.lang.BACK,
                    type: 'back',
                    fa: global.explorer.backIcon,
                    path: global.lang.OPTIONS,
                    tabindex: 0,
                    action: () => {
                        let actives = global.config.get('countries') || []
                        console.warn('COUNTRYBACK', this.countriesEntriesOriginalActives.sort().join(','), actives.sort().join(','))
                        if(this.countriesEntriesOriginalActives.sort().join(',') != actives.sort().join(',')){
                            global.energy.askRestart()
                        }
                    }
                })
                if(map.some(row => !actives.includes(row.code))){
                    entries.push({
                        name: global.lang.SELECT_ALL,
                        type: 'action',
                        fa: 'fas fa-check-circle',
                        action: () => {
                            global.config.set('countries', map.map(row => row.code))
                            global.explorer.refresh()
                        }
                    })
                } else {
                    entries.push({
                        name: global.lang.DESELECT_ALL,
                        type: 'action',
                        fa: 'fas fa-times-circle',
                        action: () => {
                            global.config.set('countries', [])
                            global.explorer.refresh()
                        }
                    })
                }
                map.forEach(row => {
                    entries.push({
                        name : row.name,
                        type: 'check',
                        action: (e, checked) => {
                            if(checked){
                                if(!actives.includes(row.code)){
                                    actives.push(row.code)
                                }
                            } else {
                                let pos = actives.indexOf(row.code)
                                if(pos != -1){
                                    actives.splice(pos, 1)
                                }
                            }
                            global.config.set('countries', actives)
                        }, 
                        checked: () => {
                            return actives.includes(row.code)
                        }
                    })
                })
                resolve(entries)
            }).catch(reject)
        })
    }
    tos(){
        global.ui.emit('open-external-url', 'https://megacubo.net/tos')
    }
    help(){
        global.cloud.get('configure').then(c => {
            const url = (c && typeof(c.help) == 'string') ? c.help : global.MANIFEST.bugs
            global.ui.emit('open-external-url', url)
        }).catch(global.displayErr)
    }
	share(){
		global.ui.emit('share', global.ucWords(global.MANIFEST.name), global.ucWords(global.MANIFEST.name), 'https://megacubo.net/online/')
	}
    about(){
        let outdated
        cloud.get('configure').then(c => {
            updateEPGConfig(c)
            console.log('checking update...')
            let vkey = 'version'
            outdated = c[vkey] > global.MANIFEST.version
        }).catch(console.error).finally(() => {
            const os = require('os')
            let text = lang.LEGAL_NOTICE +': '+ lang.ABOUT_LEGAL_NOTICE
            let title = global.ucWords(global.MANIFEST.name) +' v'+ global.MANIFEST.version
            let versionStatus = outdated ? global.lang.OUTDATED : global.lang.CURRENT_VERSION
            title += ' ('+ versionStatus +', ' + process.platform +' '+ os.arch() +')'
            global.ui.emit('dialog', [
                {template: 'question', fa: 'fas fa-info-circle', text: title},
                {template: 'message', text},
                {template: 'option', text: 'OK', fa: 'fas fa-check-circle', id: 'ok'},
                {template: 'option', text: global.lang.HELP, fa: 'fas fa-question-circle', id: 'help'},
                {template: 'option', text: global.lang.SHARE, fa: 'fas fa-share-alt', id: 'share'},
                {template: 'option', text: global.lang.TOS, fa: 'fas fa-info-circle', id: 'tos'}
            ], 'about-callback', 'ok')
        })
    }
    aboutResources(){
        let txt = []
        async.parallel([done => {
            global.diagnostics.checkDisk().then(data => {
                txt[1] = 'Free disk space: '+ global.kbfmt(data.free) +'<br />'
            }).catch(console.error).finally(() => done())
        }, done => {
            global.diagnostics.checkMemory().then(freeMem => {
                const used = process.memoryUsage().rss
                txt[0] = 'App memory usage: '+ global.kbfmt(used) +'<br />Free memory: '+ global.kbfmt(freeMem) +'<br />'
            }).catch(console.error).finally(() => done())
        }], () => {
            txt[2] = 'Connection speed: '+ global.kbsfmt(global.streamer.downlink || 0) +'<br />'
            txt[3] = global.config.get('ua') +'<br />'
            global.ui.emit('info', 'System info', txt.join(''))
        })
    }
    aboutNetwork(){
        let data = 'Network IP: '+ global.networkIP()
        if(process.platform == 'android'){
            data += '<br />'+ global.androidIPCommand()
        } 
        global.ui.emit('info', 'Network IP', data)
    }
    /*
    aboutNetwork(){
        let text = 'Network IP: '+ global.networkIP()
        if(process.platform == 'android'){
            text += '<br />'+ global.androidIPCommand()
        } 
        global.ui.emit('dialog', [
            {template: 'question', text: 'Network IP'},
            {template: 'message', text},
            {template: 'option', text: 'OK', fa: 'fas fa-check-circle', id: 'ok'},
            {template: 'option', text: global.lang.EDIT, fa: 'fas fa-edit', id: 'edit'}
        ], 'about-network-callback', 'ok')
    }
    */
    resetConfig(){
        let text = global.lang.RESET_CONFIRM
        global.ui.emit('dialog', [
            {template: 'question', text: global.ucWords(global.MANIFEST.name)},
            {template: 'message', text},
            {template: 'option', text: global.lang.YES, fa: 'fas fa-info-circle', id: 'yes'},
            {template: 'option', text: global.lang.NO, fa: 'fas fa-times-circle', id: 'no'}
        ], 'reset-callback', 'no')
    }
    playbackEntries(){
        return new Promise((resolve, reject) => {
            let opts = [
                {
                    name: 'Control playback rate according to the buffer', type: 'check', action: (data, checked) => {
                    global.config.set('playback-rate-control', checked)
                }, checked: () => {
                    return global.config.get('playback-rate-control')
                }, details: 'Recommended'}, 
                {
                    name: 'HLS prefetch', type: 'check', action: (data, checked) => {
                    global.config.set('hls-prefetch', checked)
                }, checked: () => {
                    return global.config.get('hls-prefetch')
                }},
                {
                    name: 'FFmpeg CRF',
                    fa: 'fas fa-film',
                    type: 'slider', 
                    range: {start: 15, end: 30},
                    action: (data, value) => {
                        global.config.set('ffmpeg-crf', value)
                    }, 
                    value: () => {
                        return global.config.get('ffmpeg-crf')
                    }
                },            
                {
                    name: 'Transcoding', type: 'select', fa: 'fas fa-film',
                    renderer: () => {
                        return new Promise((resolve, reject) => {
                            let def = global.config.get('transcoding'), opts = [
                                {name: global.lang.NEVER, type: 'action', selected: !def, action: (data) => {
                                    global.config.set('transcoding', '')
                                }},
                                {name: global.lang.TRANSCODING_ENABLED_LIMIT_X.format('480p'), type: 'action', selected: (def == '480p'), action: (data) => {
                                    global.config.set('transcoding', '480p')
                                }},
                                {name: global.lang.TRANSCODING_ENABLED_LIMIT_X.format('720p'), type: 'action', selected: (def == '720p'), action: (data) => {
                                    global.config.set('transcoding', '720p')
                                }},
                                {name: global.lang.TRANSCODING_ENABLED_LIMIT_X.format('1080p'), type: 'action', selected: (def == '1080p'), action: (data) => {
                                    global.config.set('transcoding', '1080p')
                                }}
                            ]
                            resolve(opts)
                        })
                    }
                },
                {
                    name: global.lang.ELAPSED_TIME_TO_KEEP_CACHED, 
                    details: global.lang.LIVE,
                    fa: 'fas fa-hdd', 
                    type: 'slider', 
                    range: {start: 30, end: 7200},
                    action: (data, value) => {
                        console.warn('ELAPSED_TIME_TO_KEEP_CACHED', data, value)
                        global.config.set('live-window-time', value)
                    }, 
                    value: () => {
                        return global.config.get('live-window-time')
                    }
                },
                {
                    name: 'Use keepalive connections', type: 'check', action: (data, checked) => {
                    global.config.set('use-keepalive', checked)
                }, checked: () => {
                    return global.config.get('use-keepalive')
                }, details: 'Recommended'}
            ]
            resolve(opts)
        })
    }
    tuneEntries(){
        return new Promise((resolve, reject) => {
            let opts = [
                {
                    name: global.lang.TEST_STREAMS, type: 'check', action: (data, checked) => {
                    global.config.set('auto-testing', checked)
                }, checked: () => {
                    return global.config.get('auto-testing')
                }},
                {
                    name: global.lang.TEST_STREAMS_TYPE, type: 'check', action: (data, checked) => {
                    global.config.set('status-flags-type', checked)
                }, checked: () => {
                    return global.config.get('status-flags-type')
                }},
                {
                    name: global.lang.PREFER_HLS, type: 'check', action: (data, checked) => {
                    global.config.set('tuning-prefer-hls', checked)
                }, checked: () => {
                    return global.config.get('tuning-prefer-hls')
                }},
                {
                    name: global.lang.TUNING_CONCURRENCY_LIMIT, 
                    fa: 'fas fa-poll-h', 
                    type: 'slider', 
                    range: {start: 1, end: 8},
                    action: (data, value) => {
                        console.warn('TUNING_CONCURRENCY_LIMIT', data, value)
                        global.config.set('tuning-concurrency', value)
                    }, 
                    value: () => {
                        return global.config.get('tuning-concurrency')
                    }
                },
                {
                    name: global.lang.CONNECT_TIMEOUT, 
                    fa: 'fas fa-plug', 
                    type: 'slider', 
                    range: {start: 5, end: 60},
                    action: (data, value) => {
                        console.warn('CONNECT_TIMEOUT', data, value)
                        global.config.set('connect-timeout', value)
                    }, 
                    value: () => {
                        return global.config.get('connect-timeout')
                    }
                },
                {
                    name: 'Prefer IPv6', type: 'check', action: (data, checked) => {
                    global.config.set('prefer-ipv6', checked)
                }, checked: () => {
                    return global.config.get('prefer-ipv6')
                }}  
            ]
            if(global.config.get('shared-mode-reach')){
                opts.push({
                    name: global.lang.COMMUNITARY_LISTS, 
                    type: 'slider', 
                    fa: 'fas fa-users', 
                    mask: '{0} ' + global.lang.COMMUNITARY_LISTS.toLowerCase(), 
                    value: () => {
                        return global.config.get('shared-mode-reach')
                    }, 
                    range: {start: 5, end: 24},
                    action: (data, value) => {
                        global.config.set('shared-mode-reach', value)
                    }
                })
            }
            resolve(opts)
        })
    }
    requestClearCache(){
        let folders = [global.storage.folder, global.paths.temp, global.icons.opts.folder], size = 0, gfs = require('get-folder-size')
        async.eachOf(folders, (folder, i, done) => {
            gfs(folder, (err, s) => {
                if(!err){
                    size += s
                }
                done()
            })
        }, () => {
            let highUsage = size > (512 * (1024 * 1024))
            size = '<font class="faclr-' + (highUsage ? 'red' : 'green') + '">' + global.kbfmt(size) + '</font>'
            global.ui.emit('dialog', [
                {template: 'question', text: global.lang.CLEAR_CACHE, fa: 'fas fa-broom'},
                {template: 'message', text: global.lang.CLEAR_CACHE_WARNING.format(size)},
                {template: 'option', text: global.lang.YES, id: 'yes', fa: 'fas fa-check-circle'},
                {template: 'option', text: global.lang.NO, id: 'no', fa: 'fas fa-times-circle'}
            ], 'clear-cache', 'no')
        })
    }
    clearCache(){
        global.osd.show(global.lang.CLEANING_CACHE, 'fa-mega spin-x-alt', 'clear-cache', 'persistent')
        global.ui.emit('clear-cache')
        global.streamer.stop()
        if(global.tuning){
            global.tuning.destroy()
            global.tuning = null
        }
        let folders = [global.storage.folder, global.paths.temp, global.icons.opts.folder]
        async.eachOf(folders, (folder, i, done) => {
            global.rmdir(folder, false, done)
        }, () => {
            global.osd.show('OK', 'fas fa-check-circle', 'clear-cache', 'normal')
            global.config.save()
			global.energy.restart()
        })
    }
    entries(){
        return new Promise((resolve, reject) => {
            let secOpt = {
                name: global.lang.SECURITY, fa: 'fas fa-shield-alt', type: 'group', 
                entries: [
                {
                    name: global.lang.ADULT_CONTENT,
                    fa: 'fas fa-user-lock',
                    type: 'select',
                    safe: true,
                    renderer: () => {
                        return new Promise((resolve, reject) => {
                            let def = global.config.get('parental-control-policy'), options = [
                                {
                                    key: 'allow',
                                    fa: 'fas fa-lock-open'
                                }, 
                                {
                                    key: 'block',
                                    fa: 'fas fa-lock'
                                }, 
                                {
                                    key: 'only',
                                    fa: 'fas fa-fire'
                                }
                            ].map(n => {
                                return {
                                    name: global.lang[n.key.replaceAll('-', '_').toUpperCase()],
                                    value: n.key,
                                    icon: n.fa,
                                    type: 'action',
                                    safe: true,
                                    action: (data) => {
                                        global.config.set('parental-control-policy', n.key)
                                        global.explorer.refresh()
                                    }
                                }
                            })                                
                            options = options.map(p => {
                                p.selected = (def == p.value)
                                return p
                            })
                            resolve(options)
                        })
                    }
                }]
            }
            if(global.config.get('parental-control-policy') != 'allow'){
                secOpt.entries.push({
                    name: global.lang.FILTER_WORDS,
                    type: 'input',
                    fa: 'fas fa-shield-alt',
                    action: (e, v) => {
                        if(v !== false){
                            global.config.set('parental-control-terms', v)
                        }
                    },
                    value: () => {
                        return global.config.get('parental-control-terms')
                    },
                    placeholder: global.lang.FILTER_WORDS,
                    multiline: true,
                    safe: true
                })
            }
            let opts = [
                {name: global.lang.PERFORMANCE_MODE, details: global.lang.SELECT, fa: 'fas fa-tachometer-alt', type: 'action', action: () => this.performance()},
                {name: global.lang.BEHAVIOUR, type: 'group', fa: 'fas fa-window-restore', renderer: () => {
                    return new Promise((resolve, reject) => {
                        let opts = [
                            {name: global.lang.RESUME_PLAYBACK, type: 'check', action: (data, checked) => {
                                global.config.set('resume', checked)
                            }, checked: () => {
                                return global.config.get('resume')
                            }},
                            {
                                name: global.lang.AUTO_MINIPLAYER, type: 'check', action: (data, checked) => {
                                global.config.set('miniplayer-auto', checked)
                            }, checked: () => {
                                return global.config.get('miniplayer-auto')
                            }},                            
                            {
                                name: global.lang.SHOW_LOGOS,
                                type: 'check',
                                action: (e, checked) => {
                                    global.config.set('show-logos', checked)
                                }, 
                                checked: () => {
                                    return global.config.get('show-logos')
                                }
                            },                       
                            {
                                name: global.lang.PLAY_UI_SOUNDS,
                                type: 'check',
                                action: (e, checked) => {
                                    global.config.set('ui-sounds', checked)
                                }, 
                                checked: () => {
                                    return global.config.get('ui-sounds')
                                }
                            },
                            {
                                name: global.lang.SEARCH_MISSING_LOGOS,
                                type: 'check',
                                action: (e, checked) => {
                                    global.config.set('search-missing-logos', checked)
                                }, 
                                checked: () => {
                                    return global.config.get('search-missing-logos')
                                }
                            },
                            {
                                name: global.lang.HIDE_BACK_BUTTON, 
                                type: 'check', 
                                action: (data, value) => {
                                    global.config.set('hide-back-button', value)
                                    global.explorer.refresh()
                                }, 
                                checked: () => {
                                    return global.config.get('hide-back-button')
                                }
                            }
                        ]
                        if(!global.cordova){
                            opts.push({
                                name: global.lang.SPEAK_NOTIFICATIONS, 
                                type: 'check', 
                                action: (data, value) => {
                                    global.config.set('osd-speak', value)
                                }, 
                                checked: () => {
                                    return global.config.get('osd-speak')
                                }
                            })
                        }
                        opts.push({
                            name: global.lang.WINDOW_MODE_TO_START,
                            fa: 'fas fa-window-maximize', 
                            type: 'select', 
                            renderer: () => {
                                return new Promise((resolve, reject) => {
                                    let def = global.config.get('startup-window'), opts = [
                                        {name: global.lang.NORMAL, fa: 'fas fa-ban', type: 'action', selected: (def == ''), action: (data) => {
                                            global.config.set('startup-window', '')
                                        }},
                                        {name: global.lang.FULLSCREEN, fa: 'fas fa-window-maximize', type: 'action', selected: (def == 'fullscreen'), action: (data) => {
                                            global.config.set('startup-window', 'fullscreen')
                                        }}
                                    ]
                                    if(!global.cordova){
                                        opts.push({name: 'Miniplayer', fa: 'fas fa-level-down-alt', type: 'action', selected: (def == 'miniplayer'), action: (data) => {
                                            global.config.set('startup-window', 'miniplayer')
                                        }})
                                    }
                                    resolve(opts)
                                })
                            }
                        })
                        resolve(opts)
                    })
                }},
                {name: global.lang.LANGUAGE, fa: 'fas fa-language', type: 'action', action: () => this.showLanguageEntriesDialog()},
                {name: global.lang.COUNTRIES, details: global.lang.COUNTRIES_HINT, fa: 'fas fa-globe', type: 'group', renderer: () => this.countriesEntries()},
                secOpt,
                {name: global.lang.MANAGE_CHANNEL_LIST, fa: 'fas fa-list', type: 'group', details: global.lang.LIVE, renderer: global.channels.options.bind(global.channels)},
                {name: global.lang.ADVANCED, fa: 'fas fa-cogs', type: 'group', renderer: () => {
                    return new Promise((resolve, reject) => {
                        resolve([
                            {name: global.lang.TUNE, fa: 'fas fa-satellite-dish', type: 'group', renderer: this.tuneEntries.bind(this)},
                            {name: global.lang.PLAYBACK, fa: 'fas fa-play', type: 'group', renderer: this.playbackEntries.bind(this)},
                            {
                                name: 'Enable console logging', type: 'check', action: (data, checked) => {
                                global.config.set('enable-console', checked)
                            }, checked: () => {
                                return global.config.get('enable-console')
                            }}, 
                            {
                                name: 'Unoptimized search', type: 'check', action: (data, checked) => {
                                global.config.set('unoptimized-search', checked)
                            }, checked: () => {
                                return global.config.get('unoptimized-search')
                            }},  
                            {  
                                name: global.lang.CLEAR_CACHE, icon: 'fas fa-broom', type: 'action', action: () => this.requestClearCache()
                            },
                            {
                                name: 'System info', fa: 'fas fa-memory', type: 'action', action: this.aboutResources.bind(this)
                            },
                            {
                                name: 'Network IP', fa: 'fas fa-globe', type: 'action', action: this.aboutNetwork.bind(this)
                            },
                            {
                                name: global.lang.FFMPEG_VERSION, 
                                fa: 'fas fa-info-circle', 
                                type: 'action', 
                                action: global.ffmpeg.diagnosticDialog.bind(global.ffmpeg)
                            },
                            {
                                name: global.lang.RESET_CONFIG, 
                                type: 'action',
                                fa: 'fas fa-undo-alt', 
                                action: () => this.resetConfig()
                            }
                        ])
                    })
                }},
                {
                    name: global.lang.EXPORT_IMPORT,
                    type: 'group',
                    fa: 'fas fa-file-import',
                    entries: [
                        {
                            name: global.lang.EXPORT_CONFIG,
                            type: 'action',
                            fa: 'fas fa-file-export', 
                            action: () => {
                                this.export(file => {
                                    global.downloads.serve(file, true, false).catch(global.displayErr)
                                })
                            }
                        },
                        {
                            name: global.lang.IMPORT_CONFIG,
                            type: 'action',
                            fa: 'fas fa-file-import', 
                            action: () => {
                                global.ui.emit('open-file', global.ui.uploadURL, 'config-import-file', 'application/json, application/zip, application/octet-stream, application/x-zip-compressed, multipart/x-zip', global.lang.IMPORT_CONFIG)
                            }
                        }
                    ]
                }
            ]
            resolve(opts)
        })
    }
    hook(entries, path){
        return new Promise((resolve, reject) => {
            if(path == '' && !entries.some(e => e.name == global.lang.TOOLS)){
                entries.splice(entries.length - 2, 0, {name: global.lang.TOOLS, fa: 'fas fa-box-open', type: 'group', renderer: this.tools.bind(this)})
                entries = entries.concat([
                    {name: global.lang.OPTIONS, fa: 'fas fa-cog', type: 'group', details: global.lang.CONFIGURE, renderer: this.entries.bind(this)},
                    {name: global.lang.ABOUT, fa: 'fas fa-info-circle', type: 'action', action: this.about.bind(this)},
                    {name: global.lang.EXIT, fa: 'fas fa-power-off', type: 'action', action: global.energy.askExit.bind(global.energy)}
                ])
            }
            resolve(entries)
        })
    }
}

module.exports = Options
