import type {Metadata} from 'next';
import Announced from '@/components/Announced';
import {announcedOffers,type AnnouncedResult} from '@/lib/announced';
export const metadata:Metadata={title:'Ofertas divulgadas recentemente — Baixou!',description:'Preços publicados pelas próprias lojas (Pichau, Terabyte) nos canais do Telegram nas últimas 48 horas. Disponibilidade não confirmada.'};
// Lista já no HTML, regenerada a cada 2 min; o cliente atualiza em segundo plano se o HTML estiver mais velho.
export const revalidate=120;
export default async function Page(){let initial:AnnouncedResult|null=null;try{initial=await announcedOffers(48);}catch(e){console.error('divulgadas inicial',e instanceof Error?e.message:e);}return <Announced initial={initial}/>;}
