// Test preloader only. Blocks standard Node network clients; never reads secrets.
const deny=()=>{throw new Error('OFFLINE_TEST_NETWORK_DENIED');};
globalThis.fetch=async()=>deny();
for(const moduleName of ['node:http','node:https']){const client=require(moduleName);client.request=deny;client.get=deny;}
const net=require('node:net');net.connect=deny;net.createConnection=deny;
const tls=require('node:tls');tls.connect=deny;
