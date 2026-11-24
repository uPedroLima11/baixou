import type {Metadata} from 'next';
import Announced from '@/components/Announced';
export const metadata:Metadata={title:'Ofertas divulgadas recentemente — Baixou!',description:'Preços publicados pelas próprias lojas (Pichau, Terabyte) nos canais do Telegram nas últimas 48 horas. Disponibilidade não confirmada.'};
export default function Page(){return <Announced/>}
