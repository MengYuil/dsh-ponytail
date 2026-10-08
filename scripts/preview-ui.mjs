#!/usr/bin/env node
// Local browser fixture, not a DSH host or a model-effect benchmark.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
const toolRoot = resolve(process.env.PONYTAIL_TOOL_ROOT ?? '.')
const require = createRequire(resolve(toolRoot, 'package.json'))
const esbuild = require('esbuild')
const bootstrap = await esbuild.build({ write: false, bundle: true, format: 'iife', platform: 'browser',
  absWorkingDir: toolRoot, stdin: { resolveDir: toolRoot, contents: `
import React from 'react'; import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
let value = {defaultMode:'inherit',disabledSkills:[]};
let snapshot = {status:'ready',value,writable:true,revision:0}; const listeners = new Set();
const scope = {getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},
 async mutate(ops,revision){if(revision!==snapshot.revision)throw new Error('设置已变化，请重新编辑');
  for(const op of ops)value={...value,[op.path[0]]:op.op==='unset'?(op.path[0]==='defaultMode'?'inherit':[]):op.value};
  snapshot={...snapshot,value,revision:snapshot.revision+1};for(const fn of listeners)fn();}};
let dictionary = {}; const disposers=[];
const ctx={effect:fn=>disposers.push(fn()),inject:(_,fn)=>fn(ctx),
 locale:{bind:()=>key=>dictionary[key]??key,register:(_,dict)=>{dictionary=dict.zh;return()=>{}}},
 settingsScope:{bind:()=>scope},
 slots:{inject:(_,fn)=>fn(),register:(spec,Component)=>{root.render(React.createElement(Component,{...spec.inject(),t:key=>dictionary[key]??key}));return()=>{}}},
 commandUi:{decorate:()=>{}},remote:{commands:{execute:async()=>({ok:true,value:{}})}}};
window.__ModuleLoader__={load:row=>{const mod=row.factory(name=>{if(name==='react')return React;throw new Error(name)});mod.apply(ctx)}};
` } })
const script = bootstrap.outputFiles[0].text
const client = readFileSync('lib/client.js', 'utf8')
const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ponytail UI verification fixture</title><style>:root{--dsw-alias-border-l4:#dedede;--dsw-alias-bg-layer-3:#fff;--dsw-alias-bg-layer-2:#f4f4f4;--dsw-alias-label-primary:#222;--dsw-alias-brand-primary:#345cdd}body{font:14px system-ui;margin:24px;background:#f6f6f6}main{max-width:680px;margin:auto}ul{padding:0}h3{margin:0}details summary{cursor:pointer}</style><main><h2>Ponytail 设置</h2><p>浏览器验证样例，不连接真实 DSH 配置或模型。</p><ul id="root"></ul></main><script src="/preview.js"></script><script src="/client.js"></script></html>'
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url === '/' ? 'text/html; charset=utf-8' : 'application/javascript; charset=utf-8')
  response.end(request.url === '/' ? html : request.url === '/preview.js' ? script : client)
})
server.listen(4178, '127.0.0.1', () => console.log('Preview fixture: http://127.0.0.1:4178'))
