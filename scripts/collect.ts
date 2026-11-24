import {runCollector} from '../lib/collector';
import {throttledNotifier} from './notify-trigger';
import {adminDb} from '../lib/server';
const check=process.argv.includes('--check');
// Batimento da coleta hospedada no Actions: o pg_cron do Supabase usa para acionar a recuperação pela Vercel
// quando o encadeamento do GitHub para (migration 20261124140000).
if(!check&&process.env.GITHUB_ACTIONS==='true'){try{await adminDb().from('infra_heartbeat').upsert({name:'actions-collect',at:new Date().toISOString(),detail:'Actions '+(process.env.GITHUB_RUN_ID??'')+' '+(process.env.COLLECT_STORES??'')});}catch{}}
const result=await runCollector({check,onProgress:check?undefined:throttledNotifier()});console.log(JSON.stringify(result));if(!result.total&&!result.skipped&&result.failures>0)process.exitCode=1;
