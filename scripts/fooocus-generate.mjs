import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , figur, ausgabePfad] = process.argv;
if (!figur || !ausgabePfad) {
  console.error('Aufruf: node fooocus-generate.mjs <figur> <ausgabe.png>');
  process.exit(1);
}

const STILBLOCK = "warm children's book illustration, thick slightly irregular ink outlines, flat colors without gradients, rounded child-friendly proportions, no photorealism, simple flat ground shadow only, no text in image";
const NEGATIV = "text, watermark, logo, signature, extra limbs, extra fingers, extra tail, deformed paws, blurry, photorealistic, adult human proportions, scary, dark horror shadows, brand logo, clothed fox in full outfit, realistic fur texture, franchise character, Disney style, anime style";

const FIGUREN = {
  miro: {
    beschreibung: "young rounded chibi fox character named Miro, warm reddish-brown fur, light cream belly, bright turquoise tail tip, wearing only a small braided fir-twig bracelet with one wooden bead, big friendly eyes, no other clothing",
    seed: 424242,
  },
  lotte: {
    beschreibung: "young rounded owl character named Lotte, blue-grey feathers, round glasses made of two small twigs, perched pose",
    seed: 434343,
  },
};

const f = FIGUREN[figur];
if (!f) { console.error('Unbekannte Figur:', figur); process.exit(1); }

const PROMPT = `${STILBLOCK}, ${f.beschreibung}, character reference sheet, turnaround sheet, ` +
  `full body front view on the left, full body side view in the middle, three small head close-ups on the right showing ` +
  `happy smiling expression, curious expression with head tilted, and thoughtful expression scratching ear with paw, ` +
  `clean white background, consistent character design, orthographic reference sheet layout`;

console.log('Prompt:', PROMPT);
console.log('Seed:', f.seed);

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
await page.goto('http://127.0.0.1:7865', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(2000);

// Advanced-Panel oeffnen
await page.getByText('Advanced', { exact: true }).first().click();
await page.waitForTimeout(1000);

// Positiv-Prompt
await page.locator('textarea[placeholder="Type prompt here or paste parameters."]').fill(PROMPT);

// Settings-Tab: Negativ-Prompt, Image Number, Seed -- Felder ueber block-info-Label
// gefunden (verifizierte DOM-Struktur, siehe scripts/fooocus-inspect.mjs), nicht per
// DOM-Reihenfolge (mehrere versteckte number-Inputs in anderen Tabs sonst falsch getroffen).
await page.getByText('Settings', { exact: true }).click();
await page.waitForTimeout(500);
await page.locator('textarea[placeholder="Type prompt here."]').fill(NEGATIV);

function feldNachLabel(labelText) {
  return page.locator(`:is(fieldset,div).block:has(span[data-testid="block-info"]:text-is("${labelText}"))`)
    .first().locator('input');
}

const imgNumBox = feldNachLabel('Image Number').first();
await imgNumBox.waitFor({ state: 'visible', timeout: 10000 });
await imgNumBox.fill('1');

// Random-Checkbox abwaehlen (Label umschliesst Checkbox direkt), festen Seed eintragen
const randomCheckbox = page.locator('label:has(span:text-is("Random")) input[type=checkbox]');
await randomCheckbox.waitFor({ state: 'visible', timeout: 10000 });
if (await randomCheckbox.isChecked()) {
  await randomCheckbox.click({ force: true });
  await page.waitForTimeout(300);
}
const seedBox = feldNachLabel('Seed').first();
await seedBox.waitFor({ state: 'visible', timeout: 10000 });
await seedBox.fill(String(f.seed));

await page.waitForTimeout(500);
await page.screenshot({ path: ausgabePfad.replace('.png', '-vor-generieren.png') });

console.log('Starte Generierung -- das kann auf CPU sehr lange dauern (>60 min beobachtet).');
console.log('Fooocus speichert fertige Bilder serverseitig in Fooocus/outputs/ unabhaengig von');
console.log('dieser Browser-Sitzung -- Abholung erfolgt daher per Datei-Polling, nicht per');
console.log('DOM-Warten (das brach beim ersten Versuch nach 30 Min Client-Timeout faelschlich ab,');
console.log('obwohl die Generierung serverseitig unbeirrt weiterlief und nach ~94 Min fertig war).');
await page.getByRole('button', { name: 'Generate' }).click();
await page.waitForTimeout(15000); // sicherstellen, dass der Job in die Warteschlange kam
await browser.close();
console.log('Browser geschlossen, Job laeuft serverseitig weiter. Skript beendet sich hier bewusst.');
