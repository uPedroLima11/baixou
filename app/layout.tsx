import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Baixou! — Tecnologia por menos',description:'Encontre ofertas de hardware, periféricos e eletrônicos. Compare preços, acompanhe quedas e salve seus favoritos.',robots:{index:true,follow:true},icons:{icon:{url:'/logo.png',type:'image/png'},apple:'/logo.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR" suppressHydrationWarning><body><script dangerouslySetInnerHTML={{__html:"try{document.documentElement.dataset.theme=localStorage.getItem('baixou-theme')||'light'}catch(e){}"}}/>{children}</body></html>}
