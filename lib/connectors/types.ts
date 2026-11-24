// Contrato de conectores oficiais (APIs de marketplace/afiliado). Cada conector é independente:
// não altera os adaptadores HTML existentes e só publica anúncios aprovados por lib/connectors/policy.ts.
export type ListingCondition='new'|'used'|'refurbished'|null;
export type ListingSeller={id:string|null;name:string|null;official:boolean|null;reputationLevel:string|null;positiveRate:number|null;completedSales:number|null};
// Dados exatamente como a API oficial devolveu; nada estimado. Campos desconhecidos ficam null.
export type MarketplaceListing={paymentBasis?:'cash'|null;source:string;externalId:string;url:string;title:string;price:number;originalPrice:number|null;currency:string;available:boolean|null;condition:ListingCondition;seller:ListingSeller;images:string[];brand:string|null;mpn:string|null;gtin:string|null;couponHint:string|null;fetchedAt:string;
 // Anúncio publicado pela própria loja (ex.: canal oficial no Telegram): preço pontual, não conferido na página.
 announcement?:{channel:string;postId:number;postedAt:string;installmentTotal:number|null;label:string;latest?:boolean}};
export type ConnectorContext={env:Record<string,string|undefined>;fetch:typeof fetch;deadline:number;maxListings:number};
export type Connector={
 id:string;name:string;marketplace:boolean;
 // Nomes dos GitHub/Vercel Secrets exigidos. Sem todos presentes, o conector não roda.
 requiredEnv:string[];
 // Hosts aceitos para a URL pública do anúncio (link de afiliado fica à parte, nunca substitui a URL canônica).
 hosts:string[];
 // false até haver consulta real aprovada com credenciais; impede ativação por engano.
 implemented:boolean;
 listings(ctx:ConnectorContext):AsyncIterable<MarketplaceListing>;
};
