import { LoteGnre }     from './LoteGnre.mjs';
import { EstadoFactory } from './estados/EstadoFactory.mjs';
import { escapeXml }     from './utils.mjs';

/**
 * Lote GNRE versão 1.00 — equivalente a Sped\Gnre\Sefaz\Lote.php
 *
 * Gera o XML no formato c01_UfFavorecida / c02_receita / c03_idContribuinteEmitente ...
 * e envolve no envelope SOAP 1.2.
 *
 * Uso:
 *   const lote = new Lote();
 *   lote.addGuia(guia);
 *   const xml = lote.toXml();
 *   const resp = await connection.doRequest(lote.soapAction());
 */
export class Lote extends LoteGnre {
  #ambienteDeTeste = false;
  #estadoFactory   = null;

  getEstadoFactory() {
    if (!this.#estadoFactory) this.#estadoFactory = new EstadoFactory();
    return this.#estadoFactory;
  }

  setEstadoFactory(factory) {
    this.#estadoFactory = factory;
    return this;
  }

  utilizarAmbienteDeTeste(ativo = false) {
    this.#ambienteDeTeste = ativo;
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

  /** Gera o XML interno do lote (TLote_GNRE) sem o envelope SOAP */
  gerarXmlLote() {
    const guiasXml = this.getGuias().map(g => this.#gerarTDadosGNRE(g)).join('\n');
    return `<TLote_GNRE xmlns="http://www.gnre.pe.gov.br"><guias>${guiasXml}</guias></TLote_GNRE>`;
  }

  /** Gera o envelope SOAP completo com o lote dentro */
  toXml() {
    const nsAction = this.#ambienteDeTeste
      ? 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao'
      : 'http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao';

    const loteXml = this.gerarXmlLote();

    return `<?xml version="1.0" encoding="UTF-8"?>\
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:gnre="${nsAction}" xmlns:wsdl="http://www.gnre.pe.gov.br/wsdl/processar">\
<soap12:Header>\
<gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/wsdl/processar"><versaoDados>1.00</versaoDados></gnreCabecMsg>\
</soap12:Header>\
<soap12:Body>\
<gnre:processar>\
<gnre:gnreDadosMsg><![CDATA[${loteXml}]]></gnre:gnreDadosMsg>\
</gnre:processar>\
</soap12:Body>\
</soap12:Envelope>`;
  }

  // ── XML de uma guia (TDadosGNRE v1.00) ──────────────────────────────────

  #gerarTDadosGNRE(g) {
    const estado    = escapeXml(g.c01_UfFavorecida);
    const tipEmit   = Number(g.c27_tipoIdentificacaoEmitente);
    const tipDest   = Number(g.c34_tipoIdentificacaoDestinatario);
    const guiaEstado = this.getEstadoFactory().create(g.c01_UfFavorecida);

    const docEmitente = tipEmit === LoteGnre.EMITENTE_PESSOA_JURIDICA
      ? `<CNPJ>${escapeXml(g.c03_idContribuinteEmitente)}</CNPJ>`
      : `<CPF>${escapeXml(g.c03_idContribuinteEmitente)}</CPF>`;

    const docDest = tipDest === LoteGnre.DESTINATARIO_PESSOA_JURIDICA
      ? `<CNPJ>${escapeXml(g.c35_idContribuinteDestinatario)}</CNPJ>`
      : `<CPF>${escapeXml(g.c35_idContribuinteDestinatario)}</CPF>`;

    let xml = '<TDadosGNRE>';
    xml += `<c01_UfFavorecida>${estado}</c01_UfFavorecida>`;
    xml += `<c02_receita>${escapeXml(g.c02_receita)}</c02_receita>`;

    if (g.c25_detalhamentoReceita)
      xml += `<c25_detalhamentoReceita>${escapeXml(g.c25_detalhamentoReceita)}</c25_detalhamentoReceita>`;

    if (g.c26_produto)
      xml += `<c26_produto>${escapeXml(g.c26_produto)}</c26_produto>`;

    xml += `<c27_tipoIdentificacaoEmitente>${tipEmit}</c27_tipoIdentificacaoEmitente>`;
    xml += `<c03_idContribuinteEmitente>${escapeXml(g.c03_idContribuinteEmitente)}</c03_idContribuinteEmitente>`;
    xml += `<c28_tipoDocOrigem>${escapeXml(g.c28_tipoDocOrigem)}</c28_tipoDocOrigem>`;
    xml += `<c04_docOrigem>${escapeXml(g.c04_docOrigem)}</c04_docOrigem>`;

    if (g.c06_valorPrincipal)
      xml += `<c06_valorPrincipal>${escapeXml(g.c06_valorPrincipal)}</c06_valorPrincipal>`;

    if (g.c10_valorTotal)
      xml += `<c10_valorTotal>${escapeXml(g.c10_valorTotal)}</c10_valorTotal>`;

    xml += `<c14_dataVencimento>${escapeXml(g.c14_dataVencimento)}</c14_dataVencimento>`;

    if (g.c15_convenio)
      xml += `<c15_convenio>${escapeXml(g.c15_convenio)}</c15_convenio>`;

    xml += `<c16_razaoSocialEmitente>${escapeXml(g.c16_razaoSocialEmitente)}</c16_razaoSocialEmitente>`;

    if (g.c17_inscricaoEstadualEmitente)
      xml += `<c17_inscricaoEstadualEmitente>${escapeXml(g.c17_inscricaoEstadualEmitente)}</c17_inscricaoEstadualEmitente>`;

    xml += `<c18_enderecoEmitente>${escapeXml(g.c18_enderecoEmitente)}</c18_enderecoEmitente>`;
    xml += `<c19_municipioEmitente>${escapeXml(g.c19_municipioEmitente)}</c19_municipioEmitente>`;
    xml += `<c20_ufEnderecoEmitente>${escapeXml(g.c20_ufEnderecoEmitente)}</c20_ufEnderecoEmitente>`;

    if (g.c21_cepEmitente)
      xml += `<c21_cepEmitente>${escapeXml(g.c21_cepEmitente)}</c21_cepEmitente>`;

    if (g.c22_telefoneEmitente)
      xml += `<c22_telefoneEmitente>${escapeXml(g.c22_telefoneEmitente)}</c22_telefoneEmitente>`;

    if (tipDest) {
      xml += `<c34_tipoIdentificacaoDestinatario>${tipDest}</c34_tipoIdentificacaoDestinatario>`;
    }

    if (g.c35_idContribuinteDestinatario) {
      xml += `<c35_idContribuinteDestinatario>${escapeXml(g.c35_idContribuinteDestinatario)}</c35_idContribuinteDestinatario>`;
    }

    if (g.c36_inscricaoEstadualDestinatario)
      xml += `<c36_inscricaoEstadualDestinatario>${escapeXml(g.c36_inscricaoEstadualDestinatario)}</c36_inscricaoEstadualDestinatario>`;

    if (g.c37_razaoSocialDestinatario)
      xml += `<c37_razaoSocialDestinatario>${escapeXml(g.c37_razaoSocialDestinatario)}</c37_razaoSocialDestinatario>`;

    if (g.c38_municipioDestinatario)
      xml += `<c38_municipioDestinatario>${escapeXml(g.c38_municipioDestinatario)}</c38_municipioDestinatario>`;

    xml += `<c33_dataPagamento>${escapeXml(g.c33_dataPagamento)}</c33_dataPagamento>`;

    // c05_referencia (periodo/mes/ano/parcela)
    const refXml = guiaEstado.getNodeReferencia(g);
    if (refXml) xml += refXml;

    // c39_camposExtras
    const extrasXml = guiaEstado.getNodeCamposExtras(g);
    if (extrasXml) xml += extrasXml;

    xml += '</TDadosGNRE>';
    return xml;
  }
}
