import zlib from 'node:zlib';

export interface CiiOpts {
  number?: string; date?: string; due?: string; typeCode?: string;
  sellerName?: string; buyerName?: string; buyerContact?: string | null; buyerStreet?: string; buyerZip?: string; buyerCity?: string; buyerEmail?: string | null; buyerPhone?: string | null; buyerId?: string;
  lines?: Array<{ name: string; qty: number; unit?: string; price: string; total: string; rate?: string }>;
  net?: string; tax?: string; gross?: string; due_amount?: string; taxRate?: string; taxCategory?: string; referenced?: string;
}

/** ZUGFeRD 2.x / Factur-X (EN 16931) im Aufbau, wie Lexware Office sie erzeugt (Kleinunternehmer: Kategorie E, 0 %). */
export function ciiXml(o: CiiOpts = {}): string {
  const lines = o.lines ?? [
    { name: 'Innenreinigung Intensiv', qty: 1, unit: 'C62', price: '149.00', total: '149.00' },
    { name: 'Lackpolitur einstufig', qty: 2.5, unit: 'HUR', price: '40.00', total: '100.00' },
  ];
  const rate = o.taxRate ?? '0';
  const cat = o.taxCategory ?? 'E';
  const contact = o.buyerContact === undefined ? null : o.buyerContact;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${o.number ?? 'RE0042'}</ram:ID>
    <ram:TypeCode>${o.typeCode ?? '380'}</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${o.date ?? '20260915'}</udt:DateTimeString></ram:IssueDateTime>
    <ram:IncludedNote><ram:Content>Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</ram:Content></ram:IncludedNote>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lines.map((l, i) => `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${l.name}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${l.price}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${l.unit ?? 'C62'}">${l.qty}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat}</ram:CategoryCode><ram:RateApplicablePercent>${l.rate ?? rate}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${l.total}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join('\n')}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${o.sellerName ?? 'Carcura GbR'}</ram:Name>
        <ram:PostalTradeAddress><ram:PostcodeCode>57632</ram:PostcodeCode><ram:LineOne>Hauptstr. 7</ram:LineOne><ram:CityName>Walterschen</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">02/123/45678</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        ${o.buyerId ? `<ram:ID>${o.buyerId}</ram:ID>` : ''}
        <ram:Name>${o.buyerName ?? 'Max Mustermann'}</ram:Name>
        ${contact || o.buyerEmail !== null || o.buyerPhone ? `<ram:DefinedTradeContact>${contact ? `<ram:PersonName>${contact}</ram:PersonName>` : ''}${o.buyerPhone ? `<ram:TelephoneUniversalCommunication><ram:CompleteNumber>${o.buyerPhone}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>` : ''}${o.buyerEmail !== null ? `<ram:EmailURIUniversalCommunication><ram:URIID>${o.buyerEmail ?? 'max.mustermann@example.de'}</ram:URIID></ram:EmailURIUniversalCommunication>` : ''}</ram:DefinedTradeContact>` : ''}
        <ram:PostalTradeAddress><ram:PostcodeCode>${o.buyerZip ?? '57610'}</ram:PostcodeCode><ram:LineOne>${o.buyerStreet ?? 'Bahnhofstraße 12a'}</ram:LineOne><ram:CityName>${o.buyerCity ?? 'Altenkirchen'}</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${o.date ?? '20260915'}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent></ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${o.referenced ? `<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${o.referenced}</ram:IssuerAssignedID></ram:InvoiceReferencedDocument>` : ''}
      <ram:ApplicableTradeTax><ram:CalculatedAmount>${o.tax ?? '0.00'}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>${o.net ?? '249.00'}</ram:BasisAmount><ram:CategoryCode>${cat}</ram:CategoryCode><ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms><ram:Description>Zahlbar innerhalb von 14 Tagen ohne Abzug.</ram:Description><ram:DueDateDateTime><udt:DateTimeString format="102">${o.due ?? '20260929'}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${o.net ?? '249.00'}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${o.net ?? '249.00'}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${o.tax ?? '0.00'}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${o.gross ?? '249.00'}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${o.due_amount ?? o.gross ?? '249.00'}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

/** XRechnung (UBL) eines Lieferanten mit zwei Steuersätzen. */
export function ublXml(o: { number?: string; supplier?: string; date?: string } = {}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ID>${o.number ?? 'LS-2026-0815'}</cbc:ID>
  <cbc:IssueDate>${o.date ?? '2026-09-20'}</cbc:IssueDate>
  <cbc:DueDate>2026-10-04</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cbc:EndpointID schemeID="EM">rechnung@pflegeprofi.example</cbc:EndpointID>
    <cac:PartyName><cbc:Name>${o.supplier ?? 'PflegeProfi Handels GmbH'}</cbc:Name></cac:PartyName>
    <cac:PostalAddress><cbc:StreetName>Industriestr. 5</cbc:StreetName><cbc:CityName>Köln</cbc:CityName><cbc:PostalZone>50667</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
    <cac:PartyTaxScheme><cbc:CompanyID>DE811223344</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
    <cac:PartyLegalEntity><cbc:RegistrationName>${o.supplier ?? 'PflegeProfi Handels GmbH'}</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyName><cbc:Name>Carcura GbR</cbc:Name></cac:PartyName>
    <cac:PostalAddress><cbc:StreetName>Hauptstr. 7</cbc:StreetName><cbc:CityName>Walterschen</cbc:CityName><cbc:PostalZone>57632</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">21.70</cbc:TaxAmount>
    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>
    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">38.57</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">2.70</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>7</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">138.57</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">138.57</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">160.27</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">160.27</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">4</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>Polierpad orange 150 mm</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="EUR">25.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
  <cac:InvoiceLine><cbc:ID>2</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">38.57</cbc:LineExtensionAmount><cac:Item><cbc:Name>Fachbuch Lackpflege</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>7</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="EUR">38.57</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
</ubl:Invoice>`;
}

/** PDF/A-3 mit eingebetteter Rechnungs-XML (Aufbau wie ZUGFeRD/Factur-X). */
export function zugferdPdf(xml: string, opts: { compress?: boolean; name?: string } = {}): Buffer {
  const name = opts.name ?? 'factur-x.xml';
  const data = opts.compress === false ? Buffer.from(xml, 'utf8') : zlib.deflateSync(Buffer.from(xml, 'utf8'));
  const parts: Buffer[] = [];
  const push = (s: string | Buffer) => parts.push(typeof s === 'string' ? Buffer.from(s, 'latin1') : s);
  push('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n');
  push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(${name}) 5 0 R] >> >> /AF [5 0 R] >>\nendobj\n`);
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R >>\nendobj\n');
  push(`4 0 obj\n<< /Type /EmbeddedFile /Subtype /text#2Fxml /Params << /Size ${Buffer.byteLength(xml)} >>${opts.compress === false ? '' : ' /Filter /FlateDecode'} /Length ${data.length} >>\nstream\n`);
  push(data);
  push('\nendstream\nendobj\n');
  push(`5 0 obj\n<< /Type /Filespec /F (${name}) /UF (${name}) /AFRelationship /Data /EF << /F 4 0 R >> >>\nendobj\n`);
  const content = 'BT /F1 12 Tf 72 720 Td (Rechnung) Tj ET';
  push(`6 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  push('trailer\n<< /Root 1 0 R >>\n%%EOF\n');
  return Buffer.concat(parts);
}

/** Einfache PDF ohne eingebettete Daten (z. B. gescannte Rechnung). */
export function plainPdf(): Buffer {
  const content = 'BT /F1 12 Tf 72 720 Td (Rechnung 4711) Tj ET';
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`, 'latin1');
}
