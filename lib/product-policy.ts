export class ExcludedProduct extends Error {
 constructor(public readonly reason:'seller_untrusted'|'condition_excluded'){super(reason==='seller_untrusted'?'Vendedor fora da lista de confiança':'Condição diferente de novo ou pré-venda não incluída');}
}
// Evidência explícita no título da própria loja. Nunca procurar “usado” no marketing/descrição geral.
export const excludedCondition=(title:string)=>/\b(open[ -]?box|recertificad[oa]s?|recondicionad[oa]s?|refurbished|renewed|seminov[oa]s?|usad[oa]s?|mostru[aá]rio|pr[eé][ -]?venda)\b/i.test(title);
export function assertNewProduct(title:string){if(excludedCondition(title))throw new ExcludedProduct('condition_excluded');}
