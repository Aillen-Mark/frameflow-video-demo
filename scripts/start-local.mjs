import { spawn } from 'node:child_process';
const child=spawn(process.execPath,['scripts/run-framework.mjs','dev','--hostname','127.0.0.1','--port','4173'],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
