// Leest content/feiten.json en vult elke {{sleutel}} in met het bedrag uit content/prijzen.json.
// Zo blijft feiten.json de beschrijvende laag (namen, omvang, teksten) en komen de bedragen
// uit de tabel stolkwebdesign_prijzen, dezelfde bron als de HTML.
//
// Een onbekende sleutel gooit, want een lege plek in llms.txt is precies de stille fout die
// dit hele systeem moet voorkomen.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, laadPrijzen, formatteer } from './prijzen.mjs';

export function laadFeiten() {
  const ruw = readFileSync(join(ROOT, 'content', 'feiten.json'), 'utf8');
  const prijzen = laadPrijzen();
  const onbekend = new Set();
  const ingevuld = ruw.replace(/\{\{([a-z0-9_.]+)(?:\|([a-z-]+))?\}\}/g, (_, sleutel, formaat) => {
    if (!(sleutel in prijzen)) { onbekend.add(sleutel); return `{{${sleutel}}}`; }
    return formatteer(prijzen[sleutel], formaat || '');
  });
  if (onbekend.size) {
    throw new Error(`feiten.json verwijst naar onbekende prijssleutel(s): ${[...onbekend].join(', ')}`);
  }
  return JSON.parse(ingevuld);
}
