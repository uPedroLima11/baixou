import {brotliCompressSync,brotliDecompressSync,constants} from 'node:zlib';
import type {Offer} from './types';
// Somente catálogo PÚBLICO. Brotli reduz o snapshot abaixo do limite por entrada do Data Cache.
// O relógio original acompanha os dados: reconstruir o índice não renova a validade das ofertas nem perde deltas.
export type CatalogSnapshot={offers:Offer[];at:number;since:string};
export const encodeSnapshot=(s:CatalogSnapshot)=>brotliCompressSync(Buffer.from(JSON.stringify(s)),{params:{[constants.BROTLI_PARAM_QUALITY]:4}}).toString('base64');
export function decodeSnapshot(s:string):CatalogSnapshot{return JSON.parse(brotliDecompressSync(Buffer.from(s,'base64'),{maxOutputLength:32000000}).toString('utf8'));}
