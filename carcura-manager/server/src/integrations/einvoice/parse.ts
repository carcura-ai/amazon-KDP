import { parseXml, child, children, text, type XmlNode } from './xml.js';
import { emptyParty, kindFromTypeCode, toBp, toCents, toIsoDate, toNumber, type InvoiceLine, type InvoiceParty, type NormalizedInvoice, type VatLine } from './model.js';

export type EInvoiceSyntax = 'cii' | 'ubl';

/** Erkennt eine E-Rechnung (CII = ZUGFeRD/Factur-X/XRechnung-CII, UBL = XRechnung-UBL) und liest sie vollständig. */
export function parseEInvoice(xml: string): { syntax: EInvoiceSyntax; invoice: NormalizedInvoice } | null {
  let doc: XmlNode;
  try { doc = parseXml(xml); } catch { return null; }
  // CrossIndustryDocument = ZUGFeRD 1.0 (2014–2019), gleicher Aufbau mit älteren Elementnamen
  if (doc.name === 'CrossIndustryInvoice' || doc.name === 'CrossIndustryDocument') return { syntax: 'cii', invoice: parseCii(doc) };
  if (doc.name === 'Invoice' || doc.name === 'CreditNote') return { syntax: 'ubl', invoice: parseUbl(doc) };
  return null;
}

/* ------------------------------------------------------------------ CII (UN/CEFACT Cross Industry Invoice) */
const ciiDate = (n: XmlNode | undefined) => toIsoDate(text(n, 'DateTimeString'));

function ciiParty(p: XmlNode | undefined): InvoiceParty {
  const party = emptyParty();
  if (!p) return party;
  party.name = text(p, 'Name');
  const contact = child(p, 'DefinedTradeContact');
  party.personName = text(contact, 'PersonName');
  const addr = child(p, 'PostalTradeAddress');
  party.street = [text(addr, 'LineOne'), text(addr, 'LineTwo')].filter(Boolean).join(', ') || null;
  party.zip = text(addr, 'PostcodeCode');
  party.city = text(addr, 'CityName');
  party.country = text(addr, 'CountryID');
  party.email = text(contact, 'EmailURIUniversalCommunication', 'URIID') ?? text(p, 'URIUniversalCommunication', 'URIID');
  party.phone = text(contact, 'TelephoneUniversalCommunication', 'CompleteNumber');
  for (const reg of children(p, 'SpecifiedTaxRegistration')) {
    const id = child(reg, 'ID');
    if (id?.attrs.schemeID === 'VA') party.vatId = id.text.trim() || null;
    if (id?.attrs.schemeID === 'FC') party.taxNumber = id.text.trim() || null;
  }
  party.partyNumber = text(p, 'ID');
  const legal = text(p, 'SpecifiedLegalOrganization', 'TradingBusinessName');
  party.companyName = legal ?? null;
  return party;
}

/** Erstes vorhandenes Kind-Element aus mehreren möglichen Namen (ZUGFeRD 2.x bzw. 1.0). */
const alt = (n: XmlNode | undefined, ...names: string[]) => { for (const nm of names) { const c = child(n, nm); if (c) return c; } return undefined; };
const rateOf = (n: XmlNode | undefined) => toBp(text(n, 'RateApplicablePercent') ?? text(n, 'ApplicablePercent'));

function parseCii(doc: XmlNode): NormalizedInvoice {
  const hdr = alt(doc, 'ExchangedDocument', 'HeaderExchangedDocument');
  const tx = alt(doc, 'SupplyChainTradeTransaction', 'SpecifiedSupplyChainTradeTransaction');
  const agreement = alt(tx, 'ApplicableHeaderTradeAgreement', 'ApplicableSupplyChainTradeAgreement');
  const delivery = alt(tx, 'ApplicableHeaderTradeDelivery', 'ApplicableSupplyChainTradeDelivery');
  const settlement = alt(tx, 'ApplicableHeaderTradeSettlement', 'ApplicableSupplyChainTradeSettlement');
  const sum = alt(settlement, 'SpecifiedTradeSettlementHeaderMonetarySummation', 'SpecifiedTradeSettlementMonetarySummation');
  const lines: InvoiceLine[] = children(tx, 'IncludedSupplyChainTradeLineItem').map((li) => {
    const product = child(li, 'SpecifiedTradeProduct');
    const qtyNode = child(alt(li, 'SpecifiedLineTradeDelivery', 'SpecifiedSupplyChainTradeDelivery'), 'BilledQuantity');
    const quantity = toNumber(qtyNode?.text.trim()) ?? 1;
    const price = child(alt(li, 'SpecifiedLineTradeAgreement', 'SpecifiedSupplyChainTradeAgreement'), 'NetPriceProductTradePrice');
    const basis = toNumber(text(price, 'BasisQuantity')) ?? 1;
    const unitPrice = toCents(text(price, 'ChargeAmount'));
    const lineSettle = alt(li, 'SpecifiedLineTradeSettlement', 'SpecifiedSupplyChainTradeSettlement');
    const net = toCents(text(alt(lineSettle, 'SpecifiedTradeSettlementLineMonetarySummation', 'SpecifiedTradeSettlementMonetarySummation'), 'LineTotalAmount'));
    return {
      name: text(product, 'Name') ?? 'Position',
      description: text(product, 'Description'),
      quantity,
      unit: qtyNode?.attrs.unitCode ?? null,
      unitNetCents: unitPrice === null ? null : Math.round(unitPrice / (basis || 1)),
      netCents: net ?? (unitPrice !== null ? Math.round((unitPrice / (basis || 1)) * quantity) : 0),
      vatBp: rateOf(child(lineSettle, 'ApplicableTradeTax')),
    };
  });
  const vat: VatLine[] = children(settlement, 'ApplicableTradeTax').map((t) => ({ vatBp: rateOf(t) ?? 0, netCents: toCents(text(t, 'BasisAmount')) ?? 0, vatCents: toCents(text(t, 'CalculatedAmount')) ?? 0 }));
  // TaxTotalAmount kann mehrfach vorkommen (je Währung); die Rechnungswährung zählt
  const currency = text(settlement, 'InvoiceCurrencyCode') ?? 'EUR';
  const taxTotals = children(sum, 'TaxTotalAmount');
  const taxTotal = taxTotals.find((t) => !t.attrs.currencyID || t.attrs.currencyID === currency) ?? taxTotals[0];
  const terms = child(settlement, 'SpecifiedTradePaymentTerms');
  const notes = children(hdr, 'IncludedNote').map((n) => text(n, 'Content')).filter(Boolean).join('\n') || null;
  return {
    kind: kindFromTypeCode(text(hdr, 'TypeCode')),
    number: text(hdr, 'ID'),
    issueDate: ciiDate(child(hdr, 'IssueDateTime')),
    dueDate: ciiDate(child(terms, 'DueDateDateTime')),
    serviceDate: ciiDate(child(delivery, 'ActualDeliverySupplyChainEvent', 'OccurrenceDateTime')) ?? ciiDate(child(settlement, 'BillingSpecifiedPeriod', 'EndDateTime')),
    currency,
    seller: ciiParty(child(agreement, 'SellerTradeParty')),
    buyer: ciiParty(child(agreement, 'BuyerTradeParty')),
    lines,
    vat,
    netCents: toCents(text(sum, 'TaxBasisTotalAmount')) ?? toCents(text(sum, 'LineTotalAmount')),
    vatCents: taxTotal ? toCents(taxTotal.text.trim()) : vat.length ? vat.reduce((s, v) => s + v.vatCents, 0) : null,
    grossCents: toCents(text(sum, 'GrandTotalAmount')),
    prepaidCents: toCents(text(sum, 'TotalPrepaidAmount')),
    dueCents: toCents(text(sum, 'DuePayableAmount')),
    paymentTerms: text(terms, 'Description'),
    paid: null,
    notes,
    suggestedCategory: null,
    referencedNumber: text(settlement, 'InvoiceReferencedDocument', 'IssuerAssignedID'),
  };
}

/* ------------------------------------------------------------------ UBL 2.1 (XRechnung UBL) */
function ublParty(p: XmlNode | undefined): InvoiceParty {
  const party = emptyParty();
  const node = child(p, 'Party');
  if (!node) return party;
  party.name = text(node, 'PartyName', 'Name') ?? text(node, 'PartyLegalEntity', 'RegistrationName');
  party.companyName = text(node, 'PartyLegalEntity', 'RegistrationName');
  const addr = child(node, 'PostalAddress');
  party.street = [text(addr, 'StreetName'), text(addr, 'AdditionalStreetName')].filter(Boolean).join(', ') || null;
  party.zip = text(addr, 'PostalZone');
  party.city = text(addr, 'CityName');
  party.country = text(addr, 'Country', 'IdentificationCode');
  const contact = child(node, 'Contact');
  party.personName = text(contact, 'Name');
  party.email = text(contact, 'ElectronicMail') ?? (child(node, 'EndpointID')?.attrs.schemeID === 'EM' ? text(node, 'EndpointID') : null);
  party.phone = text(contact, 'Telephone');
  for (const ts of children(node, 'PartyTaxScheme')) {
    const id = text(ts, 'CompanyID');
    if (!id) continue;
    if ((text(ts, 'TaxScheme', 'ID') ?? 'VAT') === 'VAT' && /^[A-Z]{2}/.test(id)) party.vatId = id; else party.taxNumber = id;
  }
  party.partyNumber = text(node, 'PartyIdentification', 'ID');
  return party;
}

function parseUbl(doc: XmlNode): NormalizedInvoice {
  const credit = doc.name === 'CreditNote';
  const total = child(doc, 'LegalMonetaryTotal');
  const taxTotal = children(doc, 'TaxTotal')[0];
  const vat: VatLine[] = children(taxTotal, 'TaxSubtotal').map((s) => ({ vatBp: toBp(text(s, 'TaxCategory', 'Percent')) ?? 0, netCents: toCents(text(s, 'TaxableAmount')) ?? 0, vatCents: toCents(text(s, 'TaxAmount')) ?? 0 }));
  const lines: InvoiceLine[] = children(doc, credit ? 'CreditNoteLine' : 'InvoiceLine').map((li) => {
    const qtyNode = child(li, credit ? 'CreditedQuantity' : 'InvoicedQuantity');
    const quantity = toNumber(qtyNode?.text.trim()) ?? 1;
    const base = toNumber(text(li, 'Price', 'BaseQuantity')) ?? 1;
    const price = toCents(text(li, 'Price', 'PriceAmount'));
    const item = child(li, 'Item');
    return {
      name: text(item, 'Name') ?? 'Position',
      description: text(item, 'Description'),
      quantity,
      unit: qtyNode?.attrs.unitCode ?? null,
      unitNetCents: price === null ? null : Math.round(price / (base || 1)),
      netCents: toCents(text(li, 'LineExtensionAmount')) ?? 0,
      vatBp: toBp(text(item, 'ClassifiedTaxCategory', 'Percent')),
    };
  });
  const notes = children(doc, 'Note').map((n) => n.text.trim()).filter(Boolean).join('\n') || null;
  return {
    kind: credit ? 'credit_note' : kindFromTypeCode(text(doc, 'InvoiceTypeCode')),
    number: text(doc, 'ID'),
    issueDate: toIsoDate(text(doc, 'IssueDate')),
    dueDate: toIsoDate(text(doc, 'DueDate')) ?? toIsoDate(text(doc, 'PaymentMeans', 'PaymentDueDate')),
    serviceDate: toIsoDate(text(doc, 'Delivery', 'ActualDeliveryDate')) ?? toIsoDate(text(doc, 'InvoicePeriod', 'EndDate')),
    currency: text(doc, 'DocumentCurrencyCode') ?? 'EUR',
    seller: ublParty(child(doc, 'AccountingSupplierParty')),
    buyer: ublParty(child(doc, 'AccountingCustomerParty')),
    lines,
    vat,
    netCents: toCents(text(total, 'TaxExclusiveAmount')) ?? toCents(text(total, 'LineExtensionAmount')),
    vatCents: toCents(text(taxTotal, 'TaxAmount')),
    grossCents: toCents(text(total, 'TaxInclusiveAmount')),
    prepaidCents: toCents(text(total, 'PrepaidAmount')),
    dueCents: toCents(text(total, 'PayableAmount')),
    paymentTerms: text(doc, 'PaymentTerms', 'Note'),
    paid: null,
    notes,
    suggestedCategory: null,
    referencedNumber: text(doc, 'BillingReference', 'InvoiceDocumentReference', 'ID'),
  };
}
