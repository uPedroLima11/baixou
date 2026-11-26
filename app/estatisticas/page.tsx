import type {Metadata} from 'next';
import Stats from '@/components/Stats';
import {buildStats,type StatsResult} from '@/lib/stats-data';
export const metadata:Metadata={title:'Estatísticas de preços — Baixou!',description:'Preços de memórias RAM e placas de vídeo por configuração real (módulo, kit, modelo) nas lojas monitoradas pelo Baixou!.'};
// Painel já com o conteúdo de Memória RAM (7 dias) no HTML; regenerado a cada 10 min. Filtros e outras abas
// consultam /api/stats (mesma função, cache de borda).
export const revalidate=600;
export default async function Page(){let initial:StatsResult|null=null;try{initial=await buildStats('ram',{},7);}catch(e){console.error('stats inicial',e instanceof Error?e.message:e);}return <Stats initial={initial}/>;}
