import test from 'node:test';
import assert from 'node:assert/strict';
import { imageLoadDimensions } from '../src/domain/image-layout.ts';
test('native image load dimensions remain validated without changing aspect ratio',()=>{
  assert.deepEqual(imageLoadDimensions({nativeEvent:{source:{width:1200,height:1600}}}),{width:1200,height:1600});
});
test('Expo web decoded dimensions work without a native-only event or an exception',()=>{
  assert.deepEqual(imageLoadDimensions({source:{width:1,height:1,url:'blob:fixture'}}),{width:1,height:1});
  assert.deepEqual(imageLoadDimensions({source:{width:1600,height:1200,url:'blob:fixture'}}),{width:1600,height:1200});
});
test('missing, invalid and oversized load dimensions fail safely on either platform',()=>{
  for(const event of [null,{}, {nativeEvent:{}},{nativeEvent:{source:{width:0,height:1}}},{nativeEvent:{source:{width:NaN,height:1}}},{nativeEvent:{source:{width:5000,height:5000}}},{nativeEvent:{target:{naturalWidth:Infinity,naturalHeight:1}}}])assert.equal(imageLoadDimensions(event),null);
});
