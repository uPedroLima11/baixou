import Catalog from '@/components/Catalog';export default async function Product({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Catalog initialProduct={id}/>}
