!function(){"use strict";const e=(e=>e.CapacitorPlatforms=(e=>{const t=new Map;t.set("web",{name:"web"});const n=e.CapacitorPlatforms||{currentPlatform:{name:"web"},platforms:t};return n.addPlatform=(e,t)=>{n.platforms.set(e,t)},n.setPlatform=e=>{n.platforms.has(e)&&(n.currentPlatform=n.platforms.get(e))},n})(e))("undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{});var t;e.addPlatform,e.setPlatform,function(e){e.Unimplemented="UNIMPLEMENTED",e.Unavailable="UNAVAILABLE"}(t||(t={}));class CapacitorException extends Error{constructor(e,t,n){super(e),this.message=e,this.code=t,this.data=n}}const createCapacitor=e=>{var n,r,i,o,a;const s=e.CapacitorCustomPlatform||null,l=e.Capacitor||{},c=l.Plugins=l.Plugins||{},d=e.CapacitorPlatforms,u=(null===(n=null==d?void 0:d.currentPlatform)||void 0===n?void 0:n.getPlatform)||(()=>null!==s?s.name:(e=>{var t,n;return(null==e?void 0:e.androidBridge)?"android":(null===(n=null===(t=null==e?void 0:e.webkit)||void 0===t?void 0:t.messageHandlers)||void 0===n?void 0:n.bridge)?"ios":"web"})(e)),p=(null===(r=null==d?void 0:d.currentPlatform)||void 0===r?void 0:r.isNativePlatform)||(()=>"web"!==u()),h=(null===(i=null==d?void 0:d.currentPlatform)||void 0===i?void 0:i.isPluginAvailable)||(e=>{const t=m.get(e);return!!(null==t?void 0:t.platforms.has(u()))||!!w(e)}),w=(null===(o=null==d?void 0:d.currentPlatform)||void 0===o?void 0:o.getPluginHeader)||(e=>{var t;return null===(t=l.PluginHeaders)||void 0===t?void 0:t.find((t=>t.name===e))}),m=new Map,b=(null===(a=null==d?void 0:d.currentPlatform)||void 0===a?void 0:a.registerPlugin)||((e,n={})=>{const r=m.get(e);if(r)return console.warn(`Capacitor plugin "${e}" already registered. Cannot register plugins twice.`),r.proxy;const i=u(),o=w(e);let a;const createPluginMethodWrapper=r=>{let c;const wrapper=(...d)=>{const u=(async()=>(!a&&i in n?a=a="function"==typeof n[i]?await n[i]():n[i]:null!==s&&!a&&"web"in n&&(a=a="function"==typeof n.web?await n.web():n.web),a))().then((n=>{const a=((n,r)=>{var a,s;if(!o){if(n)return null===(s=n[r])||void 0===s?void 0:s.bind(n);throw new CapacitorException(`"${e}" plugin is not implemented on ${i}`,t.Unimplemented)}{const t=null==o?void 0:o.methods.find((e=>r===e.name));if(t)return"promise"===t.rtype?t=>l.nativePromise(e,r.toString(),t):(t,n)=>l.nativeCallback(e,r.toString(),t,n);if(n)return null===(a=n[r])||void 0===a?void 0:a.bind(n)}})(n,r);if(a){const e=a(...d);return c=null==e?void 0:e.remove,e}throw new CapacitorException(`"${e}.${r}()" is not implemented on ${i}`,t.Unimplemented)}));return"addListener"===r&&(u.remove=async()=>c()),u};return wrapper.toString=()=>`${r.toString()}() { [capacitor code] }`,Object.defineProperty(wrapper,"name",{value:r,writable:!1,configurable:!1}),wrapper},d=createPluginMethodWrapper("addListener"),p=createPluginMethodWrapper("removeListener"),addListenerNative=(e,t)=>{const n=d({eventName:e},t),remove=async()=>{const r=await n;p({eventName:e,callbackId:r},t)},r=new Promise((e=>n.then((()=>e({remove:remove})))));return r.remove=async()=>{console.warn("Using addListener() without 'await' is deprecated."),await remove()},r},h=new Proxy({},{get(e,t){switch(t){case"$$typeof":return;case"toJSON":return()=>({});case"addListener":return o?addListenerNative:d;case"removeListener":return p;default:return createPluginMethodWrapper(t)}}});return c[e]=h,m.set(e,{name:e,proxy:h,platforms:new Set([...Object.keys(n),...o?[i]:[]])}),h});return l.convertFileSrc||(l.convertFileSrc=e=>e),l.getPlatform=u,l.handleError=t=>e.console.error(t),l.isNativePlatform=p,l.isPluginAvailable=h,l.pluginMethodNoop=(e,t,n)=>Promise.reject(`${n} does not have an implementation of "${t}".`),l.registerPlugin=b,l.Exception=CapacitorException,l.DEBUG=!!l.DEBUG,l.isLoggingEnabled=!!l.isLoggingEnabled,l.platform=l.getPlatform(),l.isNative=l.isNativePlatform(),l},n=(e=>e.Capacitor=createCapacitor(e))("undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{}),r=n.registerPlugin;n.Plugins;class WebPlugin{constructor(e){this.listeners={},this.windowListeners={},e&&(console.warn(`Capacitor WebPlugin "${e.name}" config object was deprecated in v3 and will be removed in v4.`),this.config=e)}addListener(e,t){this.listeners[e]||(this.listeners[e]=[]),this.listeners[e].push(t);const n=this.windowListeners[e];n&&!n.registered&&this.addWindowListener(n);const remove=async()=>this.removeListener(e,t),r=Promise.resolve({remove:remove});return Object.defineProperty(r,"remove",{value:async()=>{console.warn("Using addListener() without 'await' is deprecated."),await remove()}}),r}async removeAllListeners(){this.listeners={};for(const e in this.windowListeners)this.removeWindowListener(this.windowListeners[e]);this.windowListeners={}}notifyListeners(e,t){const n=this.listeners[e];n&&n.forEach((e=>e(t)))}hasListeners(e){return!!this.listeners[e].length}registerWindowListener(e,t){this.windowListeners[t]={registered:!1,windowEventName:e,pluginEventName:t,handler:e=>{this.notifyListeners(t,e)}}}unimplemented(e="not implemented"){return new n.Exception(e,t.Unimplemented)}unavailable(e="not available"){return new n.Exception(e,t.Unavailable)}async removeListener(e,t){const n=this.listeners[e];if(!n)return;const r=n.indexOf(t);this.listeners[e].splice(r,1),this.listeners[e].length||this.removeWindowListener(this.windowListeners[e])}addWindowListener(e){window.addEventListener(e.windowEventName,e.handler),e.registered=!0}removeWindowListener(e){e&&(window.removeEventListener(e.windowEventName,e.handler),e.registered=!1)}}const encode=e=>encodeURIComponent(e).replace(/%(2[346B]|5E|60|7C)/g,decodeURIComponent).replace(/[()]/g,escape),decode=e=>e.replace(/(%[\dA-F]{2})+/gi,decodeURIComponent);class CapacitorCookiesPluginWeb extends WebPlugin{async getCookies(){const e=document.cookie,t={};return e.split(";").forEach((e=>{if(e.length<=0)return;let[n,r]=e.replace(/=/,"CAP_COOKIE").split("CAP_COOKIE");n=decode(n).trim(),r=decode(r).trim(),t[n]=r})),t}async setCookie(e){try{const t=encode(e.key),n=encode(e.value),r=`; expires=${(e.expires||"").replace("expires=","")}`,i=(e.path||"/").replace("path=",""),o=null!=e.url&&e.url.length>0?`domain=${e.url}`:"";document.cookie=`${t}=${n||""}${r}; path=${i}; ${o};`}catch(e){return Promise.reject(e)}}async deleteCookie(e){try{document.cookie=`${e.key}=; Max-Age=0`}catch(e){return Promise.reject(e)}}async clearCookies(){try{const e=document.cookie.split(";")||[];for(const t of e)document.cookie=t.replace(/^ +/,"").replace(/=.*/,`=;expires=${(new Date).toUTCString()};path=/`)}catch(e){return Promise.reject(e)}}async clearAllCookies(){try{await this.clearCookies()}catch(e){return Promise.reject(e)}}}r("CapacitorCookies",{web:()=>new CapacitorCookiesPluginWeb});const buildRequestInit=(e,t={})=>{const n=Object.assign({method:e.method||"GET",headers:e.headers},t),r=((e={})=>{const t=Object.keys(e);return Object.keys(e).map((e=>e.toLocaleLowerCase())).reduce(((n,r,i)=>(n[r]=e[t[i]],n)),{})})(e.headers)["content-type"]||"";if("string"==typeof e.data)n.body=e.data;else if(r.includes("application/x-www-form-urlencoded")){const t=new URLSearchParams;for(const[n,r]of Object.entries(e.data||{}))t.set(n,r);n.body=t.toString()}else if(r.includes("multipart/form-data")||e.data instanceof FormData){const t=new FormData;if(e.data instanceof FormData)e.data.forEach(((e,n)=>{t.append(n,e)}));else for(const n of Object.keys(e.data))t.append(n,e.data[n]);n.body=t;const r=new Headers(n.headers);r.delete("content-type"),n.headers=r}else(r.includes("application/json")||"object"==typeof e.data)&&(n.body=JSON.stringify(e.data));return n};class CapacitorHttpPluginWeb extends WebPlugin{async request(e){const t=buildRequestInit(e,e.webFetchExtra),n=((e,t=!0)=>e?Object.entries(e).reduce(((e,n)=>{const[r,i]=n;let o,a;return Array.isArray(i)?(a="",i.forEach((e=>{o=t?encodeURIComponent(e):e,a+=`${r}=${o}&`})),a.slice(0,-1)):(o=t?encodeURIComponent(i):i,a=`${r}=${o}`),`${e}&${a}`}),"").substr(1):null)(e.params,e.shouldEncodeUrlParams),r=n?`${e.url}?${n}`:e.url,i=await fetch(r,t),o=i.headers.get("content-type")||"";let a,s,{responseType:l="text"}=i.ok?e:{};switch(o.includes("application/json")&&(l="json"),l){case"arraybuffer":case"blob":s=await i.blob(),a=await(async e=>new Promise(((t,n)=>{const r=new FileReader;r.onload=()=>{const e=r.result;t(e.indexOf(",")>=0?e.split(",")[1]:e)},r.onerror=e=>n(e),r.readAsDataURL(e)})))(s);break;case"json":a=await i.json();break;default:a=await i.text()}const c={};return i.headers.forEach(((e,t)=>{c[t]=e})),{data:a,headers:c,status:i.status,url:i.url}}async get(e){return this.request(Object.assign(Object.assign({},e),{method:"GET"}))}async post(e){return this.request(Object.assign(Object.assign({},e),{method:"POST"}))}async put(e){return this.request(Object.assign(Object.assign({},e),{method:"PUT"}))}async patch(e){return this.request(Object.assign(Object.assign({},e),{method:"PATCH"}))}async delete(e){return this.request(Object.assign(Object.assign({},e),{method:"DELETE"}))}}r("CapacitorHttp",{web:()=>new CapacitorHttpPluginWeb});const i=r("CapacitorNodeJS",{web:()=>Promise.resolve().then((function(){return w})).then((e=>new e.CapacitorNodeJSWeb)),electron:()=>window.CapacitorCustomPlatform.plugins.CapacitorNodeJS});const o=new class NodeJSPlugin{constructor(){this.listenerList=[]}start(e){return i.start(e)}send(e){return i.send(e)}whenReady(){return i.whenReady()}addListener(e,t){const n=i.addListener(e,(e=>{t(e)}));return this.listenerList.push({eventName:e,listenerHandle:n}),n}async removeListener(e){"electron"===n.getPlatform()?await i.removeListener(e):await e.remove();for(let t=0;t<this.listenerList.length;t++){const n=this.listenerList[t];if(e===await n.listenerHandle){this.listenerList.splice(t,1);break}}}async removeAllListeners(e){for(const t of[...this.listenerList])if(!e||e===t.eventName){const e=await t.listenerHandle;await this.removeListener(e)}}},a=r("KeepAwake",{web:()=>Promise.resolve().then((function(){return m})).then((e=>new e.KeepAwakeWeb))}),s=r("App",{web:()=>Promise.resolve().then((function(){return b})).then((e=>new e.AppWeb))}),l=r("NativeFileDownloader",{web:()=>Promise.resolve().then((function(){return f})).then((e=>new e.NativeFileDownloaderWeb))});var c,d;!function(e){e.Dark="DARK",e.Light="LIGHT",e.Default="DEFAULT"}(c||(c={})),function(e){e.Body="body",e.Ionic="ionic",e.Native="native",e.None="none"}(d||(d={}));const u=r("Keyboard"),p=r("Share",{web:()=>Promise.resolve().then((function(){return v})).then((e=>new e.ShareWeb))}),h=r("SplashScreen",{web:()=>Promise.resolve().then((function(){return g})).then((e=>new e.SplashScreenWeb))});window.capacitor={NodeJS:o,App:s,Share:p,KeepAwake:a,Keyboard:u,NativeFileDownloader:l,SplashScreen:h};var w=Object.freeze({__proto__:null,CapacitorNodeJSWeb:class CapacitorNodeJSWeb extends WebPlugin{unavailableNodeJS(){return this.unavailable("The NodeJS engine is not available in the browser!")}start(){throw this.unavailableNodeJS()}send(){throw this.unavailableNodeJS()}whenReady(){throw this.unavailableNodeJS()}}});var m=Object.freeze({__proto__:null,KeepAwakeWeb:class KeepAwakeWeb extends WebPlugin{constructor(){super(...arguments),this.wakeLock=null,this._isSupported="wakeLock"in navigator}async keepAwake(){this._isSupported||this.throwUnsupportedError(),this.wakeLock&&await this.allowSleep(),this.wakeLock=await navigator.wakeLock.request("screen")}async allowSleep(){var e;this._isSupported||this.throwUnsupportedError(),null===(e=this.wakeLock)||void 0===e||e.release(),this.wakeLock=null}async isSupported(){return{isSupported:this._isSupported}}async isKeptAwake(){this._isSupported||this.throwUnsupportedError();return{isKeptAwake:!!this.wakeLock}}throwUnsupportedError(){throw this.unavailable("Screen Wake Lock API not available in this browser.")}}});var b=Object.freeze({__proto__:null,AppWeb:class AppWeb extends WebPlugin{constructor(){super(),this.handleVisibilityChange=()=>{const e={isActive:!0!==document.hidden};this.notifyListeners("appStateChange",e),document.hidden?this.notifyListeners("pause",null):this.notifyListeners("resume",null)},document.addEventListener("visibilitychange",this.handleVisibilityChange,!1)}exitApp(){throw this.unimplemented("Not implemented on web.")}async getInfo(){throw this.unimplemented("Not implemented on web.")}async getLaunchUrl(){return{url:""}}async getState(){return{isActive:!0!==document.hidden}}async minimizeApp(){throw this.unimplemented("Not implemented on web.")}}});var f=Object.freeze({__proto__:null,NativeFileDownloaderWeb:class NativeFileDownloaderWeb extends WebPlugin{async scheduleFileDownload(e){const t=document.createElement("a");return t.href=e.url,t.download=e.fileName,t.style.display="none",document.body.appendChild(t),t.click(),document.body.removeChild(t),{downloadId:void 0}}}});var v=Object.freeze({__proto__:null,ShareWeb:class ShareWeb extends WebPlugin{async canShare(){return"undefined"!=typeof navigator&&navigator.share?{value:!0}:{value:!1}}async share(e){if("undefined"==typeof navigator||!navigator.share)throw this.unavailable("Share API not available in this browser");return await navigator.share({title:e.title,text:e.text,url:e.url}),{}}}});var g=Object.freeze({__proto__:null,SplashScreenWeb:class SplashScreenWeb extends WebPlugin{async show(e){}async hide(e){}}})}();
