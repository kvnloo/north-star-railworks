import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
function run(args){
 const result=spawnSync(process.execPath,args,{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
for(const file of readdirSync('web/valley').filter(name=>name.endsWith('.js')).sort())run(['--check',`web/valley/${file}`]);
for(const file of ['verify_valley','verify_valley_trains','verify_cameras','verify_forest','verify_steam','verify_tunnel','verify_render_quality'])run([`scripts/${file}.mjs`]);
