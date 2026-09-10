// Windows fallback for this host's native fs.cpSync exit during Sites packaging.
// Preload only for the official Sites packager, preserving its path/tree checks.
const fs = require('node:fs');
const path = require('node:path');
// Propagate the bounded compatibility preload to the packager's Node child.
if (!process.env.NODE_OPTIONS?.includes(__filename.replaceAll('\\', '/'))) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --require="${__filename.replaceAll('\\', '/')}"`.trim();
}
fs.cpSync = function copyRegularTree(source, target) {
  const stat = fs.lstatSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) copyRegularTree(path.join(source, entry), path.join(target, entry));
  } else if (stat.isFile()) fs.copyFileSync(source, target);
  else throw new Error('Only regular build files may be copied.');
};
if(process.platform === 'win32') {
  const cp=require('node:child_process'), original=cp.spawn;
  cp.spawn=function(executable,args,options) {
    if(/(?:^|[\\/])cmd\.exe$/i.test(executable) && args?.at(-1)==='""npm" "run" "build""') {
      return original(process.execPath,[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'run','build'],{...options,windowsVerbatimArguments:false});
    }
    if(executable==='bash' && args?.[0]?.endsWith('package-site.sh')) {
      return original('C:/Program Files/Git/bin/bash.exe',args.map(a=>a.replaceAll('\\','/')),options);
    }
    return original(executable,args,options);
  };
  require('node:module').syncBuiltinESMExports();
}
