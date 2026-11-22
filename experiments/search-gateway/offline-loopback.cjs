// Test preloader: no credentials/env access; no external network or public bind.
const http=require('node:http');const https=require('node:https');const net=require('node:net');const tls=require('node:tls');
const denied=()=>{throw new Error('OFFLINE_EXTERNAL_NETWORK_DENIED')};
function allowed(host){return host==='127.0.0.1'||host==='::1'}
function target(args){let first=args[0];if(Array.isArray(first))first=first[0];if(typeof first==='object'&&first!==null)return first.hostname||first.host;if(typeof first==='number')return typeof args[1]==='string'?args[1]:undefined;return undefined}
const originalConnect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){if(!allowed(target(args)))return denied();return originalConnect.apply(this,args)};
const originalListen=net.Server.prototype.listen;
net.Server.prototype.listen=function(...args){if(!allowed(target(args)))return denied();return originalListen.apply(this,args)};
for(const mod of [http,https])for(const method of ['get','request']){const original=mod[method];mod[method]=function(...args){const first=args[0];let host;if(typeof first==='string'||first instanceof URL){try{host=new URL(first).hostname}catch{return denied()}}else host=target(args);if(!allowed(host)||mod===https)return denied();return original.apply(this,args)}}
tls.connect=denied;
const dns=require('node:dns');
for(const name of Object.keys(dns))if(/^(?:lookup|resolve|reverse)/.test(name)&&typeof dns[name]==='function')dns[name]=denied;
for(const name of Object.keys(dns.promises))if(/^(?:lookup|resolve|reverse)/.test(name)&&typeof dns.promises[name]==='function')dns.promises[name]=async()=>denied();
// Node listen() calls lookup() even for a literal. Resolve only that literal in
// memory, never via a resolver or a network packet.
dns.lookup=function(host,options,callback){if(!allowed(host))return denied();const opts=typeof options==='object'&&options?options:{};const cb=typeof options==='function'?options:callback;if(typeof cb!=='function')return denied();const family=host==='127.0.0.1'?4:6;queueMicrotask(()=>opts.all?cb(null,[{address:host,family}]):cb(null,host,family));};
dns.promises.lookup=async function(host,options){if(!allowed(host))return denied();const value={address:host,family:host==='127.0.0.1'?4:6};return options?.all?[value]:value;};
require('node:dgram').createSocket=denied;
require('node:http2').connect=denied;
require('node:module').syncBuiltinESMExports();
const fetch=globalThis.fetch;
globalThis.fetch=async function(input,init){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(url.protocol!=='http:'||!allowed(url.hostname))return denied();return fetch(input,{...init,redirect:'error'})};
