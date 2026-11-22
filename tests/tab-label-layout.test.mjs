import test from 'node:test';
import assert from 'node:assert/strict';
import { labelExtraHeight, navigationBarHeight } from '../src/components/tab-label-layout.ts';
test('normal labels keep the existing 72dp bar and additive safe area',()=>{
 for(const height of [12,14,16])assert.equal(navigationBarHeight(labelExtraHeight(height,'below-icon'),0),72);
 assert.equal(navigationBarHeight(labelExtraHeight(24,'beside-icon'),20),92);
});
test('multiline enlarged labels get enough vertical space plus an icon gap',()=>{
 for(const height of [28,48,101.4,135.2,220]){
  const result=navigationBarHeight(labelExtraHeight(height,'below-icon'),0);
  assert.ok(result>=height+55+6);assert.ok(result>=72);
 }
});
test('landscape/tablet label metrics retain their normal leading and expand when needed',()=>{
 assert.equal(labelExtraHeight(24,'beside-icon'),0);assert.equal(navigationBarHeight(labelExtraHeight(96,'beside-icon'),12),162);
});
test('invalid transient measurements never produce a negative or nonfinite navigation height',()=>{
 for(const value of [NaN,Infinity,-20]){assert.equal(labelExtraHeight(value,'below-icon'),0);assert.equal(navigationBarHeight(value,value),72)}
});
test('growth is recomputed from the current label, not accumulated after scale changes',()=>{
 const enlarged=navigationBarHeight(labelExtraHeight(135,'below-icon'),0);assert.ok(enlarged>72);assert.equal(navigationBarHeight(labelExtraHeight(14,'below-icon'),0),72);
});
