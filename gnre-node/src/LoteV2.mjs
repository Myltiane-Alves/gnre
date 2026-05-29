import { Lote }      from './Lote.mjs';
import { LoteGnre }  from './LoteGnre.mjs';
import { escapeXml } from './utils.mjs';

/**
 * Lote GNRE versão 2.00 — equivalente a Sped\Gnre\Sefaz\LoteV2.php
 *
 * Gera o XML no formato ufFavorecida / contribuinteEmitente / itensGNRE ...
 * usado pelo portal GNRE atual (versao="2.00").
 *
 * Uso:
 *   const lote = new LoteV2();
 *   lote.utilizarAmbienteDeTeste(true);
 *   lote.addGuia(guia);
 *   const xml = lote.toXml();
 */
export class LoteV2 extends Lote {
  #ambienteDeTeste = false;

  utilizarAmbienteDeTeste(ativo = false) {
    this.#ambienteDeTeste = ativo;
    super.utilizarAmbienteDeTeste(ativo);
  }

  getHeaderSoap() {
    const action = this.#ambienteDeTeste
      ? 'http://www.testegnre.pe.gov.br/webservice/GnreRecepcaoLote'
      : 'http://www.gnre.pe.gov.br/webservice/GnreRecepcaoLote';

    return [
      `Content-Type: application/soap+xml;charset=utf-8;action="${action}"`,
      'SOAPAction: processar',
    ];
  }

  soapAction() {
    return this.#ambienteDeTeste
      ? 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao'
      : 'https://www.gnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao';
  }

  /** Gera o XML interno do lote (TLote_GNRE versao="2.00") sem envelope SOAP */
  gerarXmlLote() {
    const guiasXml = this.getGuias().map((g, i) => this.#gerarTDadosGNREV2(g, i + 1)).join('\n');
    return `<TLote_GNRE versao="2.00" xmlns="http://www.gnre.pe.gov.br"><guias>${guiasXml}</guias></TLote_GNRE>`;
  }

  /** Gera o envelope SOAP 1.2 completo com o lote v2 dentro */
  toXml() {
    const nsAction = this.#ambienteDeTeste
      ? 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao'
      : 'http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao';

    const loteXml = this.gerarXmlLote();

    return `<?xml version="1.0" encoding="UTF-8"?>\
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">\
<soap12:Header>\
<gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/wsdl/processar"><versaoDados>2.00</versaoDados></gnreCabecMsg>\
</soap12:Header>\
<soap12:Body>\
<gnreDadosMsg xmlns="${nsAction}">${loteXml}</gnreDadosMsg>\
</soap12:Body>\
</soap12:Envelope>`;
  }

  // ── Código do tipo de documento por UF (v2) ──────────────────────────────

  getCodigoDoc(uf, difal = false) {
    const mapa = {
      AC: '10', AL: '10', AP: '10', AM: '22', BA: '10', CE: '10',
      DF: '10', ES: '10', GO: '10', MA: '10', MT: '10', MS: '10',
      MG: '10', PA: '10', PB: '10', PR: '10', PI: '10', RN: '10',
      RO: '10', RR: '10', SP: '10', SE: '10', TO: '10',
      PE: difal ? '24' : '22',
      RJ: '24',
      RS: '22',
      SC: '24',
    };
    return mapa[String(uf).toUpperCase()] ?? '10';
  }

  /** Retorna se o campo documentoOrigem deve receber 'numero' ou 'chave' por UF */
  getNumDoc(uf) {
    const chave = new Set(['AM', 'PE', 'RJ', 'RS', 'SC']);
    return chave.has(String(uf).toUpperCase()) ? 'chave' : 'numero';
  }

  // ── XML de uma guia (TDadosGNRE v2.00) ──────────────────────────────────

  #gerarTDadosGNREV2(g, identificador = 1) {
    const uf      = escapeXml(g.c01_UfFavorecida);
    const tipEmit = Number(g.c27_tipoIdentificacaoEmitente);
    const tipDest = Number(g.c34_tipoIdentificacaoDestinatario);

    const identEmit = tipEmit === LoteGnre.EMITENTE_PESSOA_JURIDICA
      ? `<CNPJ>${escapeXml(g.c03_idContribuinteEmitente)}</CNPJ>`
      : `<CPF>${escapeXml(g.c03_idContribuinteEmitente)}</CPF>`;

    const identDest = tipDest === LoteGnre.DESTINATARIO_PESSOA_JURIDICA
      ? `<CNPJ>${escapeXml(g.c35_idContribuinteDestinatario)}</CNPJ>`
      : `<CPF>${escapeXml(g.c35_idContribuinteDestinatario)}</CPF>`;

    // contribuinteEmitente
    let emitXml = `<identificacao>${identEmit}</identificacao>`;
    if (g.c16_razaoSocialEmitente) emitXml += `<razaoSocial>${escapeXml(g.c16_razaoSocialEmitente)}</razaoSocial>`;
    if (g.c18_enderecoEmitente)    emitXml += `<endereco>${escapeXml(g.c18_enderecoEmitente)}</endereco>`;
    if (g.c19_municipioEmitente)   emitXml += `<municipio>${escapeXml(g.c19_municipioEmitente)}</municipio>`;
    if (g.c20_ufEnderecoEmitente)  emitXml += `<uf>${escapeXml(g.c20_ufEnderecoEmitente)}</uf>`;
    if (g.c21_cepEmitente)         emitXml += `<cep>${escapeXml(g.c21_cepEmitente)}</cep>`;
    if (g.c22_telefoneEmitente)    emitXml += `<telefone>${escapeXml(g.c22_telefoneEmitente)}</telefone>`;

    // referência
    const mes = g.mes ?? String(new Date().getMonth() + 1).padStart(2, '0');
    const ano = g.ano ?? new Date().getFullYear();
    const per = g.periodo ?? '0';
    let refXml = `<periodo>${escapeXml(per)}</periodo>`;
    refXml += `<mes>${escapeXml(mes)}</mes>`;
    refXml += `<ano>${escapeXml(ano)}</ano>`;
    if (g.parcela) refXml += `<parcela>${escapeXml(g.parcela)}</parcela>`;

    // contribuinteDestinatario
    let destXml = `<identificacao>${identDest}</identificacao>`;
    if (g.c37_razaoSocialDestinatario) destXml += `<razaoSocial>${escapeXml(g.c37_razaoSocialDestinatario)}</razaoSocial>`;
    if (g.c36_inscricaoEstadualDestinatario)
      destXml += `<IE>${escapeXml(g.c36_inscricaoEstadualDestinatario)}</IE>`;
    if (g.c38_municipioDestinatario) destXml += `<municipio>${escapeXml(g.c38_municipioDestinatario)}</municipio>`;

    // camposExtras v2 (só codigo + valor, sem tipo)
    const extrasXml = this.#gerarCamposExtras(g);

    const tipoDoc = this.getCodigoDoc(g.c01_UfFavorecida);

    let xml = `<TDadosGNRE versao="2.00">`;
    xml += `<ufFavorecida>${uf}</ufFavorecida>`;
    xml += `<tipoGnre>0</tipoGnre>`;
    xml += `<contribuinteEmitente>${emitXml}</contribuinteEmitente>`;
    xml += `<itensGNRE><item>`;
    xml += `<receita>${escapeXml(g.c02_receita)}</receita>`;
    xml += `<documentoOrigem tipo="${escapeXml(tipoDoc)}">${escapeXml(g.c04_docOrigem)}</documentoOrigem>`;
    xml += `<referencia>${refXml}</referencia>`;
    if (g.c14_dataVencimento) xml += `<dataVencimento>${escapeXml(g.c14_dataVencimento)}</dataVencimento>`;
    if (g.c06_valorPrincipal) {
      xml += `<valor tipo="11">${escapeXml(g.c06_valorPrincipal)}</valor>`;
      xml += `<valor tipo="21">${escapeXml(g.c06_valorPrincipal)}</valor>`;
    }
    xml += `<contribuinteDestinatario>${destXml}</contribuinteDestinatario>`;
    if (extrasXml) xml += extrasXml;
    xml += `</item></itensGNRE>`;

    if (g.c10_valorTotal) xml += `<valorGNRE>${escapeXml(g.c10_valorTotal)}</valorGNRE>`;
    if (g.c33_dataPagamento) xml += `<dataPagamento>${escapeXml(g.c33_dataPagamento)}</dataPagamento>`;

    const idGuia = g.c42_identificadorGuia ?? identificador;
    xml += `<identificadorGuia>${escapeXml(idGuia)}</identificadorGuia>`;
    xml += `</TDadosGNRE>`;

    return xml;
  }

  #gerarCamposExtras(g) {
    if (!Array.isArray(g.c39_camposExtras) || g.c39_camposExtras.length === 0) return null;

    let xml = '<camposExtras>';
    for (const item of g.c39_camposExtras) {
      const ce = item.campoExtra ?? item;
      xml += `<campoExtra>`;
      xml += `<codigo>${escapeXml(ce.codigo)}</codigo>`;
      xml += `<valor>${escapeXml(ce.valor)}</valor>`;
      xml += `</campoExtra>`;
    }
    xml += '</camposExtras>';
    return xml;
  }
}
