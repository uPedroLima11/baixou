import {runCollector} from '../lib/collector';
import {throttledNotifier} from './notify-trigger';
const check=process.argv.includes('--check');
const result=await runCollector({check,onProgress:check?undefined:throttledNotifier()});console.log(JSON.stringify(result));if(!result.total&&!result.skipped&&result.failures>0)process.exitCode=1;
