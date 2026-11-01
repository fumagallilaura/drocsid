import test from 'node:test';
import assert from 'node:assert/strict';
import { allowPermissionCheck, allowPermissionRequest, allowDisplayCapture, trustedIpc, validatePreferences, validCaptureKey, sameCaptureKey } from '../electron/policy.js';

const origin='http://127.0.0.1:4310';
const frame={url:origin+'/'};
const contents={mainFrame:frame,getURL:()=>frame.url,isDestroyed:()=>false};
const details={isMainFrame:true,requestingUrl:frame.url,securityOrigin:origin};

test('MERGE-13: copying an invite allows sanitized writes only from the trusted main frame',()=>{
  assert.equal(allowPermissionCheck(contents,'clipboard-sanitized-write',origin,details,origin),true);
  assert.equal(allowPermissionRequest(contents,'clipboard-sanitized-write',details,origin),true);
  for(const permission of ['clipboard-read','deprecated-sync-clipboard-read','unknown']) {
    assert.equal(allowPermissionCheck(contents,permission,origin,details,origin),false);
    assert.equal(allowPermissionRequest(contents,permission,details,origin),false);
  }
  for(const bad of [{...details,isMainFrame:false},{...details,requestingUrl:'https://foreign.example'},{...details,securityOrigin:'https://foreign.example'},{}]) {
    assert.equal(allowPermissionCheck(contents,'clipboard-sanitized-write',origin,bad,origin),false);
    assert.equal(allowPermissionRequest(contents,'clipboard-sanitized-write',bad,origin),false);
  }
  for(const sender of [null,{...contents,getURL:()=> 'https://foreign.example'},{...contents,isDestroyed:()=>true}]) {
    assert.equal(allowPermissionCheck(sender,'clipboard-sanitized-write',origin,details,origin),false);
    assert.equal(allowPermissionRequest(sender,'clipboard-sanitized-write',details,origin),false);
  }
  assert.equal(allowPermissionCheck(contents,'clipboard-sanitized-write','https://foreign.example',details,origin),false);
});

test('STAB-48: only main local frame may request audio, never camera',()=>{
  assert.equal(allowPermissionCheck(contents,'media',origin,{...details,mediaType:'audio'},origin),true);
  assert.equal(allowPermissionRequest(contents,'media',{...details,mediaTypes:['audio']},origin),true);
  for(const types of [['video'],['audio','video'],[],undefined])assert.equal(allowPermissionRequest(contents,'media',{...details,mediaTypes:types},origin),false);
  for(const mediaType of ['video','unknown',undefined])assert.equal(allowPermissionCheck(contents,'media',origin,{...details,mediaType},origin),false);
  for(const bad of [{...details,isMainFrame:false},{...details,requestingUrl:'https://foreign.example'},{...details,securityOrigin:'https://foreign.example'}]) {
    assert.equal(allowPermissionRequest(contents,'media',{...bad,mediaTypes:['audio']},origin),false);
    assert.equal(allowPermissionCheck(contents,'media',origin,{...bad,mediaType:'audio'},origin),false);
  }
  assert.equal(allowPermissionCheck(contents,'media','https://foreign.example',{...details,mediaType:'audio'},origin),false);
  assert.equal(allowPermissionCheck(null,'media',origin,{...details,mediaType:'audio'},origin),false);
});

test('STAB-48: privileged IPC checks the actual sender frame, not only window URL',()=>{
  assert.equal(trustedIpc({sender:contents,senderFrame:frame},origin),true);
  assert.equal(trustedIpc({sender:contents,senderFrame:{url:origin+'/'}},origin),false);
  assert.equal(trustedIpc({sender:contents,senderFrame:null},origin),false);
  assert.equal(trustedIpc({sender:{...contents,getURL:()=> 'https://foreign.example'},senderFrame:frame},origin),false);
});

test('BUILD-02: display capture accepts serialized local origin only from its main frame',()=>{
  assert.equal(allowDisplayCapture(contents,{frame,securityOrigin:origin+'/'},origin),true);
  assert.equal(allowDisplayCapture(contents,{frame:{url:origin+'/'},securityOrigin:origin},origin),false);
  assert.equal(allowDisplayCapture(contents,{frame:null,securityOrigin:origin},origin),false);
  assert.equal(allowDisplayCapture(contents,{frame,securityOrigin:'https://foreign.example'},origin),false);
});

test('STAB-45: preference contract persists only bounded supported profile fields',()=>{
  assert.deepEqual(validatePreferences({name:'Ana',server:'http://localhost:4310/?room=cafe',quality:'720',ignored:'not stored'}),{name:'Ana',server:'http://localhost:4310/?room=cafe',quality:'720'});
  for(const bad of [null,[],{name:'x'.repeat(33),server:'',quality:'1080'},{name:'Ana',server:'file:///secret',quality:'1080'},{name:'Ana',server:'http://user:password@localhost',quality:'1080'},{name:'Ana',server:'',quality:'4000'}])assert.throws(()=>validatePreferences(bad),e=>e.code==='INVALID_INPUT');
});

test('MEDIA-09/11/28: capture keys are bounded and identify exactly one call operation',()=>{
  const key={callId:'call',generation:1,operationId:'screen'};
  assert.equal(validCaptureKey(key),true);assert.equal(sameCaptureKey(key,{...key}),true);
  for(const bad of [null,[],{}, {...key,callId:''},{...key,operationId:'x'.repeat(129)},...[-1,0,1.5,Infinity,Number.MAX_SAFE_INTEGER+1].map(generation=>({...key,generation}))])assert.equal(validCaptureKey(bad),false);
  for(const other of [{...key,callId:'new'},{...key,generation:2},{...key,operationId:'new'}])assert.equal(sameCaptureKey(key,other),false);
  assert.equal(validCaptureKey({callId:'x'.repeat(128),operationId:'x'.repeat(128),generation:Number.MAX_SAFE_INTEGER}),true);
});
