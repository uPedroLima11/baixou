export class ExcludedProduct extends Error {
 constructor(public readonly reason:'seller_untrusted'|'condition_excluded'){super(reason==='seller_untrusted'?'Vendedor fora da lista de confiança':'Pré-venda/open box não incluídos');}
}
