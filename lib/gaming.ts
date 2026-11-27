// Entrada normalizada. A identificação exige que o nome seja a identidade do anúncio.
const consoleModels: [RegExp,string,string][] = [
  [/^(?:sony )?(?:playstation|ps)\s*5\b(?! portal)/, 'PlayStation 5', 'sony'],
  [/^(?:microsoft )?xbox series ([xs])\b/, 'Xbox Series', 'microsoft'],
  [/^nintendo switch\b/, 'Nintendo Switch', 'nintendo'],
  [/^(?:valve )?steam deck\b/, 'Steam Deck', 'valve'],
  [/^(?:asus )?rog (?:xbox )?ally\b/, 'ROG Ally', 'asus'],
  [/^(?:lenovo )?legion go\b/, 'Legion Go', 'lenovo'],
  [/^(?:tectoy )?zeenix\b/, 'Zeenix', 'tectoy'],
];

export function consoleFacts(title:string) {
  const text = title.trim().replace(/^bundle (?=(?:console|videogame|video game|nintendo switch|(?:sony )?playstation 5|ps5|xbox series)\b)/, '').replace(/^(?:console|videogame|video game)(?: portatil)? /, '');
  const entry = consoleModels.find(([pattern]) => pattern.test(text));
  if (!entry || /^(?:.*?\b(?:control|controller|pro controller|joy con)\b)(?: para| compat)/.test(text) ||
      /^(?:nintendo switch(?: 2)?|(?:sony )?playstation 5|ps5|xbox series [xs]) (?:pro controller|controller|controle para|carregador|acessorio|capa|suporte|jogo|dock|placa|ssd para)\b/.test(text)) return null;
  const [pattern,base,brand] = entry;
  const model = base === 'PlayStation 5'
    ? base + (/\bpro\b/.test(text) ? ' Pro' : /\bslim\b/.test(text) ? ' Slim' : '')
    : base === 'Xbox Series' ? base + ' ' + text.match(pattern)![1].toUpperCase()
    : base === 'Nintendo Switch' ? base + (/^nintendo switch 2\b/.test(text) ? ' 2' : /\boled\b/.test(text) ? ' OLED' : /\blite\b/.test(text) ? ' Lite' : '')
    : base;
  const storage = text.match(/\b(\d{1,4})\s*(gb|tb)\s*(?:ssd|de armazenamento)\b/) ??
    text.match(/\b(?:ssd|armazenamento)\s+(\d{1,4})\s*(gb|tb)\b/) ??
    text.match(/\b(\d{1,4})\s*(gb|tb)\b(?! ram| gddr| ddr)/);
  const drive = /\b(?:com leitor|leitor de disco|leitor blu ray)\b/.test(text) ? 'Com leitor'
    : /\b(?:edicao digital|all digital|sem leitor)\b/.test(text) ? 'Digital' : undefined;
  const bundle = /\b(?:bundle|com (?:\d+ )?jogos?|edicao com jogo)\b/.test(title) || /\d+ jogos?\b/.test(text)
    ? 'Bundle' : /\b(?:edicao padrao|sem jogos?)\b/.test(text) ? 'Convencional' : undefined;
  return {model,brand,storage:storage ? Number(storage[1]) * (storage[2] === 'tb' ? 1000 : 1) : undefined,drive,bundle};
}

const controllerHead = /^(?:(?:controle|controlador|joystick|gamepad)(?: sem fio| com fio)?\b|(?:sony )?dualsense\b|(?:nintendo switch(?: 2)? )?pro controller\b|(?:microsoft )?xbox wireless controller\b|8bitdo\b|gamesir\b|logitech (?:f310|f710)\b)/;
const controllerAccessory = /\b(?:capa|carregador|protetor|suporte|bateria|pelicula|cabo|adaptador|peca|reposicao|analogico avulso|placa|estacao|case)\b/;
export function controllerFacts(title:string) {
  const text = title.trim();
  if (!controllerHead.test(text) || controllerAccessory.test(text) ||
      /^(?:controle remoto|controle para tv|controlador de fan)\b/.test(text)) return null;
  const platform = text.match(/\b(?:compativel com|para) (playstation 5|ps5|ps4|xbox series [xs]|xbox one|nintendo switch(?: 2)?|pc|android|ios)\b/)?.[1];
  const model = /\bdualsense edge\b/.test(text) ? 'DualSense Edge'
    : /\bdualsense\b/.test(text) ? 'DualSense'
    : /\bnintendo switch(?: 2)? pro controller\b/.test(text) ? 'Switch Pro Controller'
    : /\bxbox wireless controller\b/.test(text) ? 'Xbox Wireless Controller'
    : text.match(/\b(?:logitech (?:f310|f710)|gamesir [a-z]+\d+[a-z]*|8bitdo (?:ultimate|pro 2|sn30 pro))\b/)?.[0];
  if (!model && !platform && !/\b(?:joystick|gamepad|gamer|gaming|xbox|playstation|nintendo switch|joy con|gamesir|8bitdo)\b/.test(text)) return null;
  return {model,platform,connection:/\bbluetooth\b/.test(text) ? 'Bluetooth'
    : /\b2 4\s*ghz\b/.test(text) ? '2,4 GHz' : /\b(?:com fio|cabo usb)\b/.test(text) ? 'USB' : undefined};
}
