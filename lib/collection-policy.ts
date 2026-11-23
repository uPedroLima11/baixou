import {classify} from './types';
import type {Source} from '../scripts/sources';
export function productURL(raw:string,source:Source){try{const u=new URL(raw,source.origin);if(u.origin!==source.origin||u.username||u.password||!source.product.test(u.pathname))return null;u.search='';u.hash='';return u.href;}catch{return null;}}
export function categoryURL(raw:string,source:Source){try{const u=new URL(raw,source.origin);if(u.origin!==source.origin||u.username||u.password||productURL(u.href,source))return null;if(!/^\/(hardware|perifericos|periferico|computadores|notebooks|monitores|monitor|cadeiras|cadeira|categoria|produtos|promocao|kits-gamer|kit-upgrade)(\/|$)/.test(u.pathname))return null;for(const [k,v] of u.searchParams)if(!['page','pagina','p'].includes(k)||!/^\d{1,3}$/.test(v)||Number(v)>20)return null;u.hash='';return u.href;}catch{return null;}}
export function candidateCategory(url:string){return classify(new URL(url).pathname.replace(/[-_/]/g,' '));}
// Round-robin category buckets prevents one large RAM category from dominating discovery.
export function diverseCandidates<T extends {category:string}>(rows:T[],limit:number){const buckets=new Map<string,T[]>();for(const row of rows){const list=buckets.get(row.category)??[];list.push(row);buckets.set(row.category,list);}const result:T[]=[];while(result.length<limit){let added=false;for(const list of buckets.values()){if(list.length&&result.length<limit){result.push(list.shift()!);added=true;}}if(!added)break;}return result;}
export function retryMinutes(failures:number){return Math.min(360,15*2**Math.min(failures,5));}
export function verificationTTL(evidence:string,discount:number){return evidence==='history'&&discount>=20?15:60;}
