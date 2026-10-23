// Zustellung an Alex und Richy unter Beachtung des 24-Stunden-Fensters von WhatsApp.
//
// Innerhalb von 24 h nach der letzten Nachricht eines Inhabers darf der Bot frei schreiben.
// Danach geht nur eine freigegebene Vorlage. Dann schicken wir eine kurze Vorlage
// ("Neue Nachricht vom Carcura-Assistenten: ...") und liefern den vollen Text nach,
// sobald der Inhaber antwortet.

const WINDOW_MS = 23.5 * 60 * 60 * 1000; // etwas Puffer vor den 24 h

export class Notifier {
  constructor({ store, wa, owners, log = console }) {
    this.store = store;
    this.wa = wa;
    this.owners = owners;
    this.log = log;
  }

  state(number) {
    const all = this.store.get("owners", {});
    return all[number] || { lastInbound: 0, pending: [], events: [] };
  }

  saveState(number, next) {
    this.store.update("owners", {}, (all) => ({ ...all, [number]: next }));
  }

  windowOpen(number, now = Date.now()) {
    return now - (this.state(number).lastInbound || 0) < WINDOW_MS;
  }

  // Merkt sich ein Ereignis, das der KI beim nächsten Chat-Turn als Kontext mitgegeben wird.
  addEvent(number, text) {
    const s = this.state(number);
    this.saveState(number, { ...s, events: [...(s.events || []), { at: Date.now(), text }].slice(-20) });
  }

  takeEvents(number) {
    const s = this.state(number);
    const events = s.events || [];
    if (events.length) this.saveState(number, { ...s, events: [] });
    return events;
  }

  // Sendet an einen Inhaber. preview = kurzer Satz für die Vorlage, falls das Fenster zu ist.
  async send(owner, text, preview) {
    if (this.windowOpen(owner.number)) {
      await this.wa.sendText(owner.number, text);
      return "text";
    }
    const s = this.state(owner.number);
    this.saveState(owner.number, { ...s, pending: [...(s.pending || []), { at: Date.now(), text }].slice(-20) });
    await this.wa.sendTemplate(owner.number, [preview || text]);
    return "template";
  }

  async sendAll(text, preview) {
    const results = {};
    for (const owner of this.owners) {
      try {
        results[owner.name] = await this.send(owner, text, preview);
      } catch (err) {
        results[owner.name] = `fehler: ${err.message}`;
        this.log.error(`[notify] an ${owner.name} fehlgeschlagen:`, err.message);
      }
    }
    return results;
  }

  // Bei jeder eingehenden Nachricht: Fenster öffnen und Zurückgehaltenes nachliefern.
  async onInbound(owner) {
    const s = this.state(owner.number);
    const pending = s.pending || [];
    this.saveState(owner.number, { ...s, lastInbound: Date.now(), pending: [] });
    for (const p of pending) {
      try {
        await this.wa.sendText(owner.number, p.text);
      } catch (err) {
        this.log.error(`[notify] Nachliefern an ${owner.name} fehlgeschlagen:`, err.message);
      }
    }
    return pending.length;
  }
}
