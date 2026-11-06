import { spawnSync } from 'node:child_process';
for(const file of ['public/app.js','public/api-client.js','server/api.mjs','server/providers.mjs','server/store.mjs','server/crypto.mjs']){
 const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status)process.exit(result.status);
}
