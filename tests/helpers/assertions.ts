import assert from 'node:assert/strict';

export function isRecord(value:unknown):value is Record<string,unknown> {
  return value!==null&&(typeof value==='object'||typeof value==='function');
}

export function required<T>(value:T|null|undefined|void):Exclude<T,null|undefined|void>;
export function required(value:unknown):{} {
  assert.ok(value!==null&&value!==undefined,'Expected the fixture value to exist');return value;
}
