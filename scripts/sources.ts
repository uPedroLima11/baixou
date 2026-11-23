export const sources=[
 {id:'kabum',name:'KaBuM!',origin:'https://www.kabum.com.br',paths:['/promocao/blackfriday','/hardware/memoria-ram','/hardware/placa-de-video-vga','/hardware/placas-mae','/hardware/processadores','/hardware/ssd-2-5','/computadores','/perifericos','/monitores','/cadeiras','/kits-gamer'],product:/\/produto\/\d+/},
 {id:'terabyte',name:'TerabyteShop',origin:'https://www.terabyteshop.com.br',paths:['/hardware/memorias','/hardware/placas-de-video','/hardware/processadores','/perifericos','/monitores','/cadeira','/pc-gamer','/kit-upgrade'],product:/\/produto\/\d+/},
 {id:'pichau',name:'Pichau',origin:'https://www.pichau.com.br',paths:['/hardware/memorias','/hardware/placa-de-video','/hardware/processadores','/perifericos','/monitores','/cadeiras','/computadores'],product:/^\/[^/]*(memoria-|placa-|processador-|monitor-|mouse-|teclado-|cadeira-|computador-)/}
] as const;
