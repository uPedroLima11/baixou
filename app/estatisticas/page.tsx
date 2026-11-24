import type {Metadata} from 'next';
import Stats from '@/components/Stats';
export const metadata:Metadata={title:'Estatísticas de preços — Baixou!',description:'Evolução e comparação de preços de memórias RAM e placas de vídeo nas lojas monitoradas pelo Baixou!.'};
export default function Page(){return <Stats/>}
