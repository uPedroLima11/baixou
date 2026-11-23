import {runCollector} from '../lib/collector';
const result=await runCollector({check:process.argv.includes('--check')});console.log(JSON.stringify(result));if(!result.total&&!result.skipped&&result.failures>0)process.exitCode=1;
