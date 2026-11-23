-- ChipArt e Shopinfo: coletas hospedadas de 23/11/2026 (collection_runs 370 e 375: 74 e 89 verificados, 0 falhas)
-- com produtos reais, loja própria confirmada e preço Pix conferido no DOM. Preço riscado/cartão não é gravado.
update public.store_registry set status='operational',homepage='https://www.chipart.com.br',
 test_product_url='https://www.chipart.com.br/produto/hardware/placamae/para-processadores-amd/b550/placamae-asus-tuf-gaming-b550mplus-chipset-b550-amd-am4-matx-ddr4/11101',verified_at=now(),
 trust_policy='Loja própria (Next.js): preco_pix do __NEXT_DATA__ igual ao "à vista no PIX" do DOM; estoque explícito; Modelo/EAN da ficha estruturada; preco_lista não é usado como preço antigo.'
where id='chipart';
update public.store_registry set status='operational',homepage='https://shopinfo.com.br',
 test_product_url='https://shopinfo.com.br/products/cooler-para-processador-intel-lga-1150-1155-1156-goldentec-gtfan-gtfan1150-25390',verified_at=now(),
 trust_policy='Shopify da própria loja (SHP Brasil, CNPJ no HTML): Pix do bloco de preço; schema = preço de cartão, nunca preço antigo; produtos com variantes recusados.'
where id='shopinfo';
