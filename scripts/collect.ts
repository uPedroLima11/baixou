import {runCollector} from '../lib/collector';
const result=await runCollector({check:process.argv.includes('--check')});if(!result.total&&!result.skipped)process.exitCode=1;
