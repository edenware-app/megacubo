import { main } from '../../../modules/bridge/renderer';
import { Menu } from '../../../modules/menu/renderer'
import { OMNI } from '../../../modules/omni/renderer'
import { CordovaWinActions, ElectronWinActions} from './window-actions'
import { Hotkeys } from './hotkeys'
import { Clock } from './clock'
import { css, loadJS, traceback } from './utils'
import swipey from 'swipey.js'
import FFmpegController from '../../../modules/ffmpeg/renderer'

var maxAlerts = 8

function exit() {
	console.log('index exit()');
	if (navigator.app) {
		navigator.app.exitApp();
	} else if (top == window) {
		window.close();
	}
}

function openExternalFile(file, mimetype) {
	console.log('openExternalFile', file);
	if (window.cordova) {
		alert('Cannot open file: ' + file.split('/').pop())
	} else if (parent.api) { // electron
		parent.api.openExternal(file)
	} else {
		window.open(file, '_system')
	}
}

function handleOpenURL(url) { 
	setTimeout(function() {
		if (url && url.match('^[a-z]*:?//')) {
			main.waitMain(() => {
				channel.post('message', ['open-url', url.replace(new RegExp('.*megacubo\.tv/(w|assistir)/', ''), 'mega://')]);
			})
		}
	}, 0);
}

function importMomentLocale(locale, cbk) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '../../node_modules/moment/locale/'+ locale +'.js', true)
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                cbk && setTimeout(() => cbk(), 100)
                var content = xhr.responseText;
                window.global = window;
                var script = document.createElement('script');
                script.type = 'text/javascript';
                try {
                    script.appendChild(document.createTextNode(content));
                } catch (e) {
                    script.text = content;
                }
                document.head.appendChild(script);
            } else {
                console.error('Request failed: ' + xhr.statusText);
            }
        }
    };
    xhr.send(null)
}

var hidingBackButton = false
function hideBackButton(doHide) {
    if (doHide != hidingBackButton) {
        hidingBackButton = doHide
        if (hidingBackButton) {
            css(' #menu a[data-type="back"] { display: none; } ', 'hide-back-button')
        } else {
            css(' ', 'hide-back-button')
        }
    }
}

function configUpdated() {
    menu.sounds.enabled = main.config['ui-sounds']
    menu.setGridLayout(main.config['view-size-x'], main.config['view-size-y'], main.config['view-size-portrait-x'], main.config['view-size-portrait-y'])
    hideBackButton(main.config['hide-back-button'])
    if (typeof (window['winActions']) == 'undefined' || !window['winActions']) {
        return
    }
    window['winActions'].enabled = main.config['miniplayer-auto']
    if (!window.cordova) {
        parent.Manager.fsapi = !!main.config['fsapi']
        if (!window.configReceived) { // run once
            window.configReceived = true
            switch (main.config['startup-window']) {
                case 'fullscreen':
                    if (parent.Manager && parent.Manager.setFullScreen) {
                        parent.Manager.setFullScreen(true)
                    }
                    break
                case 'miniplayer':
                    window['winActions'].enter()
                    break
            }
        }
    }
}

function resolveNativePath(uri, callback) {
    const originalURI = uri, errorcb = err => callback(err)
    uri = decodeURIComponent(uri).replace('/raw%3A', '/raw:')
    if (uri.startsWith('file://')) {
        uri = uri.replace('file://', '')
    }
    if (uri.indexOf('raw:') !== -1) {
        uri = uri.substr(uri.indexOf('raw:') + 4);
        uri = uri.replace(new RegExp('\\?.*$'), '')
    }
    uri = decodeURIComponent(uri)
    if (!uri.startsWith('content:')) {
        return callback(null, uri)
    }
    FilePath.resolveNativePath(originalURI, filepath => {
        resolveLocalFileSystemURL(filepath, fileEntry => {
            fileEntry.file(file => {
                const reader = new FileReader()
                reader.onloadend = () => {
                    const tempDir = cordova.file.tempDirectory, blob = new Blob([new Uint8Array(this.result)], {
                        type: file.type
                    })
                    resolveLocalFileSystemURL(tempDir, tempEntry => {
                        tempEntry.getFile(file.name, { create: true }, tempFileEntry => {
                            tempFileEntry.createWriter(writer => {
                                writer.write(blob)
                                callback(null, tempFileEntry.nativeURL)
                            }, errorcb)
                        }, errorcb)
                    }, errorcb)
                }
                reader.readAsArrayBuffer(file)
            }, errorcb)
        }, errorcb)
    }, errorcb)
}

function handleSwipe(e) {
    if (main.menu.inModal()) return
    console.log('swipey', e)
    let orientation = innerHeight > innerWidth ? 'portrait' : 'landscape'
    let swipeDist, swipeArea = ['up', 'down'].includes(e.direction) ? innerHeight : innerWidth
    switch (e.direction) {
        case 'left':
        case 'right':
            swipeDist = swipeArea / (orientation == 'portrait' ? 2 : 3)
            break
        case 'up':
        case 'down': // dont use default here to ignore diagonal moves
            swipeDist = swipeArea / (orientation == 'portrait' ? 3 : 2)
            break
    }
    if (swipeDist && e.swipeLength >= swipeDist) {
        let swipeWeight = Math.round((e.swipeLength - swipeDist) / swipeDist)
        if (swipeWeight < 1) swipeWeight = 1
        console.log('SWIPE WEIGHT', swipeWeight)
        switch (e.direction) {
            case 'left':
                if (main.menu.inPlayer() && !main.menu.isExploring()) {
                    main.hotkeys.arrowRightPressed(true)
                }
                break
            case 'right':
                if (main.menu.inPlayer() && !main.menu.isExploring()) {
                    main.hotkeys.arrowLeftPressed(true)
                } else {
                    main.hotkeys.escapePressed()
                }
                break
            case 'up': // go down
                if (main.menu.inPlayer()) {
                    if (!main.menu.isExploring()) {
                        main.hotkeys.arrowDownPressed(true)
                    }
                }
                break
            case 'down': // go up
                if (main.menu.inPlayer()) {
                    if (main.menu.isExploring()) {
                        if (!main.menu.wrap.scrollTop) {
                            main.menu.emit('menu-menu-playing', true)
                            document.body.classList.remove('menu-playing')
                        }
                    } else {
                        main.hotkeys.arrowUpPressed(false)
                    }
                }
                break
        }
    }
}

export const initApp = () => {
    console.warn('INITAPP')
    main.css = css
    window.main = main

    console.warn('INITAPP')
    if (!window.cordova) {
        main.on('ffmpeg-check', (mask, folder) => {
            console.log('Starting FFmpeg check', [mask, folder])
            parent.ffmpeg.check(mask, folder).then(ret => {
                console.log('FFmpeg checking succeeded', ret)
            }).catch(err => {
                console.error('FFmpeg checking error')
                main.osd.show(String(err), 'fas fa-exclamation-triangle faclr-red', 'ffmpeg-dl', 'normal')
            })
        })
    }
    main.on('clipboard-write', (text, successMessage) => {
        if (!top.navigator.clipboard) {
            main.osd.show('This webview doesn\'t supports copying to clipboard.', 'fas fa-exclamation-triangle faclr-red', 'clipboard', 'normal')
            return
        }
        top.navigator.clipboard.writeText(text).then(() => {
            successMessage && main.osd.show(successMessage, 'fas fa-check-circle faclr-green', 'clipboard', 'normal')
        }).catch(err => {
            main.osd.show(String(err.message || err), 'fas fa-exclamation-triangle faclr-red', 'clipboard', 'normal')
        })
    })
    main.on('open-external-url', url => winActions.openExternalURL(url))
    main.on('open-external-file', (url, mimetype) => openExternalFile(url, mimetype))
    main.on('load-js', src => {
        console.warn('LOADJS ' + src)
        var s = document.createElement('script')
        s.src = src
        s.async = true
        document.querySelector('head, body').appendChild(s)
    })
    main.on('download', (url, name) => {
        console.log('download', url, name)
        if (window.cordova) {
            checkPermissions([
                'READ_EXTERNAL_STORAGE',
                'WRITE_EXTERNAL_STORAGE'
            ], () => {
                requestFileSystem.apply(parent, [
                    LocalFileSystem.PERSISTENT,
                    0,
                    fileSystem => {
                        let target
                        if (window.cordova.platformId == 'android') {
                            target = window.cordova.file.externalRootDirectory + 'Download'
                        } else {
                            target = window.cordova.file.documentsDirectory || window.cordova.file.externalRootDirectory || fileSystem.root.nativeURL
                        }
                        target = target.replace(new RegExp('\/+$'), '')
                        main.emit('download-in-background', url, name, target)
                    }
                ])
            })
        } else {
            let e = document.createElement('a')
            e.setAttribute('href', url)
            e.setAttribute('download', name)
            e.style.display = 'none'
            document.body.appendChild(e)
            e.click()
            document.body.removeChild(e)
        }
    })
    main.on('config', configUpdated)
    main.on('fontlist', () => main.emit('fontlist', getFontList()))
    main.on('css', (css, id) => main.css(css, id))
    console.log('load app')
    menu = new Menu(document.querySelector('#menu'))
    main.menu = menu
    console.log('load app')
    main.on('sound', (n, v) => menu.sounds.play(n, v))
    menu.on('render', path => {
        if (path) {
            if (document.body.classList.contains('home')) {
                document.body.classList.remove('home')
            }
        } else {
            document.body.classList.add('home')
        }
        setTimeout(() => {
            if (typeof (haUpdate) == 'function') {
                haUpdate()
            }
        }, 0)
    })

    console.log('load app')
    configUpdated([], config)

    console.log('load app')
    menu.setGridLayout(main.config['view-size-x'], main.config['view-size-y'], main.config['view-size-portrait-x'], main.config['view-size-portrait-y']);
    ([
        {
            level: 'default',
            selector: '#menu wrap a, .menu-omni span, body:not(.video) .header-entry, body.video #menu-playing-close',
            condition: () => {
                return menu.isExploring()
            },
            resetSelector() {
                return menu.viewportEntries(false)
            },
            default: true,
            overScrollAction: (direction, e) => {
                if (direction == 'up') {
                    let playing = menu.inPlayer()
                    console.log('OVERSCROLLACTION', playing)
                    if (!playing) {
                        let n
                        if (e) {
                            let entries = menu.entries(true), i = entries.indexOf(e)
                            i++
                            if (menu.gridLayoutX == i) {
                                n = menu.container.querySelector('.header-entry:eq(0)')
                            }
                        }
                        if (!n) {
                            n = menu.container.querySelector('.menu-omni span')
                        }
                        menu.focus(n, true)
                        return true
                    } else {
                        menu.showWhilePlaying(false)
                    }
                }
            }
        },
        {
            level: 'modal',
            selector: '#modal-content input, #modal-content textarea, #modal-content .button, #modal-content a',
            condition: () => {
                return menu.inModal()
            }
        },
        {
            level: 'player',
            selector: 'controls button',
            condition: () => {
                return menu.inPlayer() && !menu.inModal() && !menu.isExploring()
            },
            overScrollAction: direction => {
                if (direction == 'down') {
                    menu.showWhilePlaying(true)
                    return true
                } else if (direction == 'up') {
                    main.idle.start()
                    return true
                }
            }
        }
    ]).forEach(menu.addSpatialNavigationLayout.bind(menu))
    console.log('load app')
    menu.start()

    console.log('load app')
    menu.on('arrow', element => {
        setTimeout(() => {
            menu.sounds.play('menu', 1)
            if (typeof (haUpdate) == 'function') {
                haUpdate()
            }
        }, 0)
    })

    document.body.addEventListener('focus', e => { // use addEventListener instead of on() here for capturing
        setTimeout(() => {
            if (document.activeElement == document.body) {
                console.log('body focus, menu.reset', e)
                menu.reset()
            }
        }, 100)
    }, { passive: true })

    console.log('load app')
    menu.on('prompt-start', menu.reset.bind(menu))
    menu.on('ask-start', menu.reset.bind(menu))

    console.log('load app')
    main.on('streamer-ready', () => {
        main.streamer.on('show', menu.reset.bind(menu))
        main.streamer.on('state', s => {
            if (s == 'playing' && menu.modalContainer && menu.modalContainer.querySelector('#modal-template-option-wait')) {
                menu.endModal()
            }
        })
        main.streamer.on('stop', () => {
            if (menu.modalContainer && (
                menu.modalContainer.querySelector('#modal-template-option-wait') ||
                menu.modalContainer.querySelector('#modal-template-option-resume')
            )) {
                menu.endModal()
            }
            menu.showWhilePlaying(false)
            menu.updateSelection() || menu.reset()
        })

        console.log('load app')
        const WinActions = window.cordova ? CordovaWinActions : ElectronWinActions
        window.winActions = new WinActions(main)
        main.on('open-file', (uploadURL, cbID, mimetypes) => {
            const next = () => {
                menu.openFile(uploadURL, cbID, mimetypes).catch(err => {
                    main.osd.show(String(err), 'fas fa-exclamation-triangle', 'menu', 'normal')
                    main.emit(cbID, null)
                }).finally(() => {
                    winActions && winActions.backgroundModeUnlock('open-file')
                })
            }
            if (window.cordova) {
                winActions && winActions.backgroundModeLock('open-file')
                checkPermissions([
                    'READ_EXTERNAL_STORAGE',
                    'WRITE_EXTERNAL_STORAGE'
                ], next)
            } else if (parent.Manager) {
                parent.Manager.openFile(mimetypes, (err, file) => main.emit(cbID, err ? null : [file]))
            } else {
                next()
            }
        })
        main.on('restart', () => winActions && winActions.restart())
        main.on('ask-exit', () => winActions && winActions.askExit())
        main.on('ask-restart', () => winActions && winActions.askRestart())
        main.on('exit', force => winActions && winActions.exit(force))
        main.on('background-mode-lock', name => {
            if (player && winActions) winActions && winActions.backgroundModeLock(name)
        })
        main.on('background-mode-unlock', name => {
            if (player && winActions) winActions && winActions.backgroundModeUnlock(name)
        });

        if (window.cordova) {
            winActions && winActions.setBackgroundMode(true) // enable once at startup to prevent service not registered crash
            window.cordova.plugins.backgroundMode.disableBatteryOptimizations()
            setTimeout(() => winActions && winActions.setBackgroundMode(false), 5000)
            window.cordova.plugins.backgroundMode.setDefaults({
                title: document.title,
                text: main.lang.RUNNING_IN_BACKGROUND || '...',
                icon: 'icon', // this will look for icon.png in platforms/android/res/drawable|mipmap
                color: main.config['background-color'].slice(-6), // hex format like 'F14F4D'
                resume: true,
                hidden: true,
                silent: false,
                allowClose: true,
                closeTitle: main.lang.CLOSE || 'X'
                //, bigText: Boolean
            })
        } else {
            document.body.addEventListener('dblclick', event => {
                const rect = document.querySelector('header').getBoundingClientRect()
                const valid = event.clientY < (rect.top + rect.height)
                if (valid) {
                    main.streamer.toggleFullScreen()
                    event.preventDefault()
                    event.stopPropagation()
                }
            })
        }
        parent.Manager && parent.Manager.appLoaded()
    })
    main.localEmit('menu-ready')
    main.emit('menu-ready')
    
    console.log('load app')

    document.querySelector('#menu-playing-close').addEventListener('click', () => {
        menu.showWhilePlaying(false)
    })
    document.querySelector('div#arrow-down-hint i').addEventListener('click', () => {
        menu.showWhilePlaying(true)
    })

    console.log('load app')
    main.omni = new OMNI()
    main.omni.on('left', () => menu.arrow('left'))
    main.omni.on('right', () => menu.arrow('right'))
    main.omni.on('down', () => menu.arrow('down'))
    main.omni.on('up', () => menu.arrow('up'))

    menu.on('scroll', y => {
        //console.log('selectionMemory scroll', y)
        menu.updateRange(y)
        elpShow()
        haUpdate()
    })

    var elp = document.querySelector('.menu-location-pagination'), elpTxt = elp.querySelector('span'), elpTimer = 0, elpDuration = 5000, elpShown = false
    const elpShow = txt => {
        clearTimeout(elpTimer)
        if (!elpShown) {
            elpShown = true
            elp.style.display = 'inline-block'
        }
        if (typeof (txt) == 'string') {
            elpTxt.innerHTML = txt
        }
        if (menu.selectedIndex < 2) {
            elpTimer = setTimeout(() => {
                if (elpShown) {
                    elpShown = false
                    elp.style.display = 'none'
                }
            }, elpDuration)
        }
    }
    const elpListener = () => {
        if(menu.currentEntries[menu.selectedIndex] && menu.currentEntries[menu.selectedIndex].top) return
        let offset = menu.path ? -1 : 0
        let total = 0
        let selected = -1
        menu.currentEntries.forEach(e => {
            if(selected == -1 && menu.selectedIndex == e.tabindex) {
                selected = total
            }
            if(e.top) return
            total++
        })
        elpShow(' ' + (selected + offset + 1) + '/' + (total + offset))
    }
    menu.on('arrow', elpListener)
    menu.on('focus', elpListener)
    menu.on('render', elpListener)

    console.log('load app')
    var haTop = document.querySelector('#home-arrows-top'), haBottom = document.querySelector('#home-arrows-bottom')
    haTop.addEventListener('click', () => menu.arrow('up'))
    haBottom.addEventListener('click', () => menu.arrow('down'))

    window['home-arrows-active'] = { bottom: null, top: null, timer: 0 };
    window.haUpdate = () => {
        const wrap = document.querySelector('#menu wrap')
        var as = wrap.getElementsByTagName('a')
        if (as.length > (menu.gridLayoutX * menu.gridLayoutY)) {
            var lastY = (as[as.length - 1].offsetTop) - wrap.scrollTop, firstY = as[0].offsetTop - wrap.scrollTop
            if (lastY >= wrap.parentNode.offsetHeight) {
                if (window['home-arrows-active'].bottom !== true) {
                    window['home-arrows-active'].bottom = true
                    haBottom.style.opacity = 'var(--opacity-level-3)'
                }
            } else {
                if (window['home-arrows-active'].bottom !== false) {
                    window['home-arrows-active'].bottom = false
                    haBottom.style.opacity = 0
                }
            }
            if (firstY < 0) {
                if (window['home-arrows-active'].top !== true) {
                    window['home-arrows-active'].top = true
                    haTop.style.opacity = 'var(--opacity-level-3)'
                }
            } else {
                if (window['home-arrows-active'].top !== false) {
                    window['home-arrows-active'].top = false
                    haTop.style.opacity = 0
                }
            }
        } else {
            window['home-arrows-active'].top = window['home-arrows-active'].bottom = false
            haTop.style.opacity = 0
            haBottom.style.opacity = 0
        }
    }

    console.log('load app')
    configUpdated([], config)

    console.log('load app')
    main.hotkeys = new Hotkeys()
    main.hotkeys.start(main.config.hotkeys)
    main.on('config', (keys, c) => {
        if (keys.includes('hotkeys')) {
            main.hotkeys.start(c.hotkeys)
        }
    })
    console.log('load app')

    main.clock = new Clock(document.querySelector('header time'))

    console.log('load app')
    moment.tz.setDefault(parent.Intl.DateTimeFormat().resolvedOptions().timeZone)
    if (main.lang.locale && !moment.locales().includes(main.lang.locale)) {
        importMomentLocale(main.lang.locale, () => {
            moment.locale(main.lang.locale)
            main.clock.update()
        })
    }
    swipey.add(document.body, handleSwipe, { diagonal: false })

    console.log('load app')
    var mouseWheelMovingTime = 0, mouseWheelMovingInterval = 200;
    ['mousewheel', 'DOMMouseScroll'].forEach(n => {
        window.addEventListener(n, event => {
            if (!menu.inPlayer() || menu.isExploring()) return
            let now = (new Date()).getTime()
            if (now > (mouseWheelMovingTime + mouseWheelMovingInterval)) {
                mouseWheelMovingTime = now
                let delta = (event.wheelDelta || -event.detail)
                if (delta > 0) {
                    //this.seekForward()
                    main.hotkeys.arrowUpPressed()
                } else {
                    //this.seekRewind()
                    main.hotkeys.arrowDownPressed()
                }
            }
        })
    })

    console.log('load app')
    main.on('share', (title, text, url) => {
        console.log('share', title, text, url)
        if (window.cordova && typeof (navigator.share) == 'function') {
            navigator.share({
                text,
                url,
                title
            }).catch(err => {
                console.error('Share error', err)
            })
        } else {
            winActions.openExternalURL('https://megacubo.tv/share/?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title) + '&text=' + encodeURIComponent(text))
        }
    })

    main.idle.on('idle', () => {
        if (menu.inPlayer() && !menu.isExploring()) {
            if (document.activeElement != document.body) {
                document.activeElement.blur()
            }
        }
    })
    main.menu.wrap.addEventListener('scroll', () => main.idle.reset());
    (new FFmpegController(parent.ffmpeg)).bind()

    console.log('load app')
    main.localEmit('renderer')
    console.log('load app')
}

window.onerror = function (message, file, line, column, errorObj) {
	let stack = typeof errorObj == 'object' && errorObj !== null && errorObj.stack ? errorObj.stack : traceback();
	console.error(errorObj || message, { errorObj, message, file, stack });
	if (maxAlerts) {
		maxAlerts--;
		if (file && 
			!file.startsWith('blob:http://') && // ignore hls.js internal errors
			!file.endsWith('mpegts.js') // ignore mpegts.js internal errors
			) {
			alert(message + ' ' + file + ':' + line + ' ' + stack);
		}
	}
	return true;
}
	
document.addEventListener('pause', function () {
	if (window.channel) {
		channel.post('message', ['suspend']);
	}
}, {passive: true});

document.addEventListener('resume', function () {
	if (window.channel) {
		channel.post('message', ['resume']);
	}
}, {passive: true});

document.addEventListener('backbutton', function (e) {
	if (window.main) {
		e.preventDefault();		
        main.hotkeys.escapePressed()
	}
}, {capture: true});

if (typeof Keyboard != 'undefined') {
	window.addEventListener('keyboardWillShow', function (event) {
		adjustLayoutForKeyboard(event.keyboardHeight)
	}, {passive: true})
	window.addEventListener('keyboardWillHide', function () {
		adjustLayoutForKeyboard(false)
	}, {passive: true})
	function adjustLayoutForKeyboard(keyboardHeight) {
		const m = document.body.querySelector('div#modal > div > div')
		if (m) {
			const mi = m.querySelector('.modal-wrap')
			if (keyboardHeight) {		
				const h = window.innerHeight - keyboardHeight
				m.style.height = h + 'px'
				if (mi && mi.offsetHeight > h) {
					var mq = mi.querySelector('span.modal-template-question')
					if (mq) {
						mq.style.display = 'none'
					}
				}
			} else {
				m.style.height = '100vh'
				if (mi) {
					mi.querySelector('span.modal-template-question').style.display = 'flex'
				}
			}
		}
	}
}
