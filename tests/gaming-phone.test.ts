import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classify, normalize} from '../lib/types';
import {consoleFacts, controllerFacts} from '../lib/gaming';
import {internationalPhone} from '../lib/phone';
import {phoneVariants} from '../lib/whatsapp';

test('consoles preservam modelo, armazenamento e pacote declarados', () => {
  const title = 'Console Sony PlayStation 5 Edição Digital Slim, SSD 825GB + 2 jogos';
  assert.equal(classify(title), 'consoles');
  assert.deepEqual(consoleFacts(normalize(title)), {
    model:'PlayStation 5 Slim', brand:'sony', storage:825, drive:'Digital', bundle:'Bundle',
  });
  assert.equal(consoleFacts(normalize('Console Nintendo Switch 2, 256GB'))?.model, 'Nintendo Switch 2');
  for (const accessory of ['Jogo para PlayStation 5', 'Capa Nintendo Switch OLED', 'Nintendo Switch Pro Controller', 'Xbox Series X SSD para expansão']) {
    assert.notEqual(classify(accessory), 'consoles', accessory);
  }
});

test('Controles exige produto de jogo e recusa peças e acessórios', () => {
  assert.equal(controllerFacts(normalize('Controle Sony DualSense Edge, Bluetooth, para PS5'))?.model,'DualSense Edge');
  for (const accessory of ['Controle de temperatura', 'Capa para controle DualSense', 'Carregador Nintendo Switch Pro Controller', 'Analógico avulso para controle Xbox']) {
    assert.equal(controllerFacts(normalize(accessory)),null,accessory);
  }
});

test('confirmar telefone produz E.164 e mantém a variante do 9º dígito apenas para o Brasil', () => {
  assert.equal(internationalPhone('(11) 91234-5678'),'+5511912345678');
  assert.equal(internationalPhone('912 345 678','PT'),'+351912345678');
  assert.equal(internationalPhone('+1 (415) 555-2671'),'+14155552671');
  assert.equal(internationalPhone('+3519123'),null);
  assert.equal(internationalPhone('ligue +14155552671'),null);
  assert.deepEqual(phoneVariants('+351912345678'),['351912345678']);
});
