import fs from 'fs';
import path from 'path';
import https from 'https';

const ENDPOINTS = {
  homologacao: {
    loteUrl: 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao',
    consultaUrl: 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreResultadoLote',
    loteMsgNamespace: 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao',
    loteHeaderAction: 'http://www.testegnre.pe.gov.br/webservice/GnreRecepcaoLote',
    consultaAction: 'http://www.testegnre.pe.gov.br/webservice/GnreResultadoLote',
  },
  producao: {
    loteUrl: 'https://www.gnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao',
    consultaUrl: 'https://www.gnre.pe.gov.br/gnreWS/services/GnreResultadoLote',
    loteMsgNamespace: 'http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao',
    loteHeaderAction: 'http://www.gnre.pe.gov.br/webservice/GnreRecepcaoLote',
    consultaAction: 'http://www.gnre.pe.gov.br/webservice/GnreResultadoLote',
  },
};

function somenteNumeros(v) {
  return v ? String(v).replace(/\D/g, '') : '';
}

function xmlEscape(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tag(nome, valor) {
  return `<${nome}>${xmlEscape(valor)}</${nome}>`;
}

function normalizarAmbiente(ambiente = 'homologacao') {
  return String(ambiente).toLowerCase() === 'producao' ? 'producao' : 'homologacao';
}

function carregarPfx({ certPfxBase64, certPfxPath }) {
  if (certPfxBase64) {
    const pfx = Buffer.from(String(certPfxBase64).replace(/\s+/g, ''), 'base64');
    if (pfx.length > 0) return pfx;
  }

  if (certPfxPath) {
    const abs = path.resolve(certPfxPath);
    if (fs.existsSync(abs)) return fs.readFileSync(abs);
  }

  const fallback = [
    process.env.CERT_PFX_PATH,
    './GTO COMERCIO 2026-2027.pfx',
    './certs/GTO COMERCIO 2026-2027.pfx',
    './src/certs/GTO COMERCIO 2026-2027.pfx',
  ].filter(Boolean);

  for (const file of fallback) {
    const abs = path.resolve(file);
    if (fs.existsSync(abs)) return fs.readFileSync(abs);
  }

  throw new Error('PFX nao encontrado. Informe certPfxBase64 ou certPfxPath.');
}

function montarIdentificacaoContribuinte(tipo, documento) {
  const doc = somenteNumeros(documento);
  if (!doc) return '';
  const tagDoc = String(tipo) === '2' ? 'CPF' : 'CNPJ';
  return `<${tagDoc}>${doc}</${tagDoc}>`;
}

function montarCamposExtrasXml(guiasCamposExtras = []) {
  if (!Array.isArray(guiasCamposExtras) || guiasCamposExtras.length === 0) {
    return '';
  }

  const campos = guiasCamposExtras
    .map((item) => {
      const codigo = item?.codigo != null ? tag('codigo', item.codigo) : '';
      const tipo = item?.tipo != null ? tag('tipo', item.tipo) : '';
      const valor = item?.valor != null ? tag('valor', item.valor) : '';
      if (!codigo && !tipo && !valor) return '';
      return `<campoExtra>${codigo}${tipo}${valor}</campoExtra>`;
    })
    .filter(Boolean)
    .join('');

  if (!campos) return '';
  return `<c39_camposExtras>${campos}</c39_camposExtras>`;
}

function montarReferenciaXml(guia) {
  if (guia?.c05_referenciaXml) {
    return String(guia.c05_referenciaXml);
  }

  if (guia?.c05_referencia && typeof guia.c05_referencia === 'object') {
    const mes = guia.c05_referencia.mes ? tag('mes', guia.c05_referencia.mes) : '';
    const ano = guia.c05_referencia.ano ? tag('ano', guia.c05_referencia.ano) : '';
    if (mes || ano) return `<c05_referencia>${mes}${ano}</c05_referencia>`;
  }

  return '';
}

function montarGuiaXml(guia) {
  const tipoEmit = String(guia.c27_tipoIdentificacaoEmitente || '1');
  const tipoDest = String(guia.c34_tipoIdentificacaoDestinatario || '1');

  const c03 = montarIdentificacaoContribuinte(tipoEmit, guia.c03_idContribuinteEmitente);
  const c35 = montarIdentificacaoContribuinte(tipoDest, guia.c35_idContribuinteDestinatario);

  const partes = [
    '<TDadosGNRE>',
    tag('c01_UfFavorecida', String(guia.c01_UfFavorecida || '').toUpperCase()),
    tag('c02_receita', guia.c02_receita || ''),
    guia.c25_detalhamentoReceita ? tag('c25_detalhamentoReceita', guia.c25_detalhamentoReceita) : '',
    guia.c26_produto ? tag('c26_produto', guia.c26_produto) : '',
    tag('c27_tipoIdentificacaoEmitente', tipoEmit),
    c03 ? `<c03_idContribuinteEmitente>${c03}</c03_idContribuinteEmitente>` : '',
    tag('c28_tipoDocOrigem', guia.c28_tipoDocOrigem || ''),
    tag('c04_docOrigem', somenteNumeros(guia.c04_docOrigem || '')),
    montarReferenciaXml(guia),
    guia.c06_valorPrincipal != null ? tag('c06_valorPrincipal', guia.c06_valorPrincipal) : '',
    guia.c10_valorTotal != null ? tag('c10_valorTotal', guia.c10_valorTotal) : '',
    tag('c14_dataVencimento', guia.c14_dataVencimento || ''),
    guia.c15_convenio ? tag('c15_convenio', guia.c15_convenio) : '',
    tag('c16_razaoSocialEmitente', guia.c16_razaoSocialEmitente || ''),
    guia.c17_inscricaoEstadualEmitente ? tag('c17_inscricaoEstadualEmitente', somenteNumeros(guia.c17_inscricaoEstadualEmitente)) : '',
    tag('c18_enderecoEmitente', guia.c18_enderecoEmitente || ''),
    tag('c19_municipioEmitente', guia.c19_municipioEmitente || ''),
    tag('c20_ufEnderecoEmitente', String(guia.c20_ufEnderecoEmitente || '').toUpperCase()),
    guia.c21_cepEmitente ? tag('c21_cepEmitente', somenteNumeros(guia.c21_cepEmitente)) : '',
    guia.c22_telefoneEmitente ? tag('c22_telefoneEmitente', somenteNumeros(guia.c22_telefoneEmitente)) : '',
    tipoDest ? tag('c34_tipoIdentificacaoDestinatario', tipoDest) : '',
    c35 ? `<c35_idContribuinteDestinatario>${c35}</c35_idContribuinteDestinatario>` : '',
    guia.c36_inscricaoEstadualDestinatario ? tag('c36_inscricaoEstadualDestinatario', somenteNumeros(guia.c36_inscricaoEstadualDestinatario)) : '',
    guia.c37_razaoSocialDestinatario ? tag('c37_razaoSocialDestinatario', guia.c37_razaoSocialDestinatario) : '',
    guia.c38_municipioDestinatario ? tag('c38_municipioDestinatario', guia.c38_municipioDestinatario) : '',
    tag('c33_dataPagamento', guia.c33_dataPagamento || ''),
    guia.c39_camposExtrasXml ? String(guia.c39_camposExtrasXml) : montarCamposExtrasXml(guia.c39_camposExtras),
    '</TDadosGNRE>',
  ];

  return partes.filter(Boolean).join('');
}

function extrairDocumentoIdentificacao(valor) {
  if (!valor) return '';
  if (typeof valor === 'string' || typeof valor === 'number') {
    return somenteNumeros(valor);
  }

  const cnpj = valor?.CNPJ ?? valor?.cnpj;
  const cpf = valor?.CPF ?? valor?.cpf;
  return somenteNumeros(cnpj || cpf || '');
}

function montarGuiaXmlV2(guia, indice = 1) {
  const tipoEmit = String(guia.c27_tipoIdentificacaoEmitente || '1');
  const tipoDest = String(guia.c34_tipoIdentificacaoDestinatario || '1');

  const docEmit = extrairDocumentoIdentificacao(guia.c03_idContribuinteEmitente);
  const docDest = extrairDocumentoIdentificacao(guia.c35_idContribuinteDestinatario);

  const idEmit = tipoEmit === '2'
    ? `<CPF>${xmlEscape(docEmit)}</CPF>`
    : `<CNPJ>${xmlEscape(docEmit)}</CNPJ>`;

  const idDest = tipoDest === '2'
    ? `<CPF>${xmlEscape(docDest)}</CPF>`
    : `<CNPJ>${xmlEscape(docDest)}</CNPJ>`;

  const valorPrincipalRaw = guia.c06_valorPrincipal ?? guia.c10_valorTotal ?? '0.00';
  const valorTotalRaw = guia.c10_valorTotal ?? guia.c06_valorPrincipal ?? '0.00';
  const valorPrincipal = xmlEscape(valorPrincipalRaw);
  const valorTotal = xmlEscape(valorTotalRaw);
  const tipoDocOrigem = xmlEscape(guia.c28_tipoDocOrigem || '10');

  const identificacaoDestIE = guia.c36_inscricaoEstadualDestinatario
    ? `<IE>${xmlEscape(somenteNumeros(guia.c36_inscricaoEstadualDestinatario))}</IE>`
    : '';

  const enderecoEmitente = guia.c18_enderecoEmitente
    ? `<endereco>${xmlEscape(guia.c18_enderecoEmitente)}</endereco>`
    : '';
  const municipioEmitenteRaw = guia.municipioEmitenteV2 || guia.c19_municipioEmitente;
  const municipioEmitente = municipioEmitenteRaw
    ? `<municipio>${xmlEscape(municipioEmitenteRaw)}</municipio>`
    : '';
  const ufEmitente = guia.c20_ufEnderecoEmitente
    ? `<uf>${xmlEscape(String(guia.c20_ufEnderecoEmitente).toUpperCase())}</uf>`
    : '';
  const cepEmitente = guia.c21_cepEmitente
    ? `<cep>${xmlEscape(somenteNumeros(guia.c21_cepEmitente))}</cep>`
    : '';
  const telefoneEmitente = guia.c22_telefoneEmitente
    ? `<telefone>${xmlEscape(somenteNumeros(guia.c22_telefoneEmitente))}</telefone>`
    : '';

  const refMes = guia?.c05_referencia?.mes ? `<mes>${xmlEscape(guia.c05_referencia.mes)}</mes>` : '';
  const refAno = guia?.c05_referencia?.ano ? `<ano>${xmlEscape(guia.c05_referencia.ano)}</ano>` : '';
  const refParcela = guia?.c05_referencia?.parcela ? `<parcela>${xmlEscape(guia.c05_referencia.parcela)}</parcela>` : '';
  const referencia = `<referencia><periodo>0</periodo>${refMes}${refAno}${refParcela}</referencia>`;

  const detalhamentoReceita = guia.c25_detalhamentoReceita
    ? `<detalhamentoReceita>${xmlEscape(guia.c25_detalhamentoReceita)}</detalhamentoReceita>`
    : '';
  const produto = guia.c26_produto
    ? `<produto>${xmlEscape(guia.c26_produto)}</produto>`
    : '';
  const convenio = guia.c15_convenio
    ? `<convenio>${xmlEscape(guia.c15_convenio)}</convenio>`
    : '';

  const camposExtras = Array.isArray(guia.c39_camposExtras) && guia.c39_camposExtras.length > 0
    ? `<camposExtras>${guia.c39_camposExtras.map((item) => {
      const codigo = item?.campoExtra?.codigo ?? item?.codigo ?? '';
      const valor = item?.campoExtra?.valor ?? item?.valor ?? '';
      if (!codigo && !valor) return '';
      return `<campoExtra><codigo>${xmlEscape(codigo)}</codigo><valor>${xmlEscape(valor)}</valor></campoExtra>`;
    }).filter(Boolean).join('')}</camposExtras>`
    : '';

  const dataPagamento = guia.c33_dataPagamento
    ? `<dataPagamento>${xmlEscape(guia.c33_dataPagamento)}</dataPagamento>`
    : '';

  return `<TDadosGNRE versao="2.00">
<ufFavorecida>${xmlEscape(String(guia.ufFavorecidaV2 || guia.c01_UfFavorecida || '').toUpperCase())}</ufFavorecida>
<tipoGnre>0</tipoGnre>
<contribuinteEmitente>
<identificacao>${idEmit}</identificacao>
<razaoSocial>${xmlEscape(guia.c16_razaoSocialEmitente || '')}</razaoSocial>
${enderecoEmitente}
${municipioEmitente}
${ufEmitente}
${cepEmitente}
${telefoneEmitente}
</contribuinteEmitente>
<itensGNRE>
<item>
<receita>${xmlEscape(guia.c02_receita || '')}</receita>
${detalhamentoReceita}
<documentoOrigem tipo="${tipoDocOrigem}">${xmlEscape(somenteNumeros(guia.c04_docOrigem || ''))}</documentoOrigem>
${produto}
${referencia}
<dataVencimento>${xmlEscape(guia.c14_dataVencimento || '')}</dataVencimento>
<valor tipo="11">${valorPrincipal}</valor>
<valor tipo="21">${valorPrincipal}</valor>
${convenio}
<contribuinteDestinatario>
<identificacao>${idDest}${identificacaoDestIE}</identificacao>
<razaoSocial>${xmlEscape(guia.c37_razaoSocialDestinatario || '')}</razaoSocial>
<municipio>${xmlEscape(guia.municipioDestinatarioV2 || guia.c38_municipioDestinatario || '')}</municipio>
</contribuinteDestinatario>
${camposExtras}
</item>
</itensGNRE>
<valorGNRE>${valorTotal}</valorGNRE>
${dataPagamento}
<identificadorGuia>${xmlEscape(String(indice))}</identificadorGuia>
</TDadosGNRE>`;
}

function montarLoteGnreXml(guias = [], versaoLote = '2.00') {
  const listaGuias = Array.isArray(guias) ? guias : [guias];

  const xmlGuias = listaGuias.map((g) => `
    <GNRE>
      <guia>
        <c01_UfFavorecida>${g.c01_UfFavorecida || ''}</c01_UfFavorecida>

        <c02_receita>${g.c02_receita || ''}</c02_receita>

        <c03_idContribuinteEmitente>
          ${g.c03_idContribuinteEmitente || ''}
        </c03_idContribuinteEmitente>

        <c04_docOrigem>${g.c04_docOrigem || ''}</c04_docOrigem>

        <c05_referencia>
          <mes>${g.c05_referencia?.mes || ''}</mes>
          <ano>${g.c05_referencia?.ano || ''}</ano>
        </c05_referencia>

        <c06_valorPrincipal>
          ${Number(g.c06_valorPrincipal || 0).toFixed(2)}
        </c06_valorPrincipal>

        <c10_valorTotal>
          ${Number(g.c10_valorTotal || 0).toFixed(2)}
        </c10_valorTotal>

        <c14_dataVencimento>
          ${g.c14_dataVencimento || ''}
        </c14_dataVencimento>

        <c15_convenio>${g.c15_convenio || ''}</c15_convenio>

        <c16_razaoSocialEmitente>
          <![CDATA[${g.c16_razaoSocialEmitente || ''}]]>
        </c16_razaoSocialEmitente>

        <c17_inscricaoEstadualEmitente>
          ${g.c17_inscricaoEstadualEmitente || ''}
        </c17_inscricaoEstadualEmitente>

        <c18_enderecoEmitente>
          <![CDATA[${g.c18_enderecoEmitente || ''}]]>
        </c18_enderecoEmitente>

        <c19_municipioEmitente>
          ${g.c19_municipioEmitente || ''}
        </c19_municipioEmitente>

        <c20_ufEnderecoEmitente>
          ${g.c20_ufEnderecoEmitente || ''}
        </c20_ufEnderecoEmitente>

        <c21_cepEmitente>
          ${g.c21_cepEmitente || ''}
        </c21_cepEmitente>

        <c22_telefoneEmitente>
          ${g.c22_telefoneEmitente || ''}
        </c22_telefoneEmitente>

        <c27_tipoIdentificacaoEmitente>
          ${g.c27_tipoIdentificacaoEmitente || '1'}
        </c27_tipoIdentificacaoEmitente>

        <c28_tipoDocOrigem>
          ${g.c28_tipoDocOrigem || '10'}
        </c28_tipoDocOrigem>

        <c33_dataPagamento>
          ${g.c33_dataPagamento || ''}
        </c33_dataPagamento>

        <c34_tipoIdentificacaoDestinatario>
          ${g.c34_tipoIdentificacaoDestinatario || '1'}
        </c34_tipoIdentificacaoDestinatario>

        <c35_idContribuinteDestinatario>
          ${g.c35_idContribuinteDestinatario || ''}
        </c35_idContribuinteDestinatario>

        <c36_inscricaoEstadualDestinatario>
          ${g.c36_inscricaoEstadualDestinatario || ''}
        </c36_inscricaoEstadualDestinatario>

        <c37_razaoSocialDestinatario>
          <![CDATA[${g.c37_razaoSocialDestinatario || ''}]]>
        </c37_razaoSocialDestinatario>

        <c38_municipioDestinatario>
          ${g.c38_municipioDestinatario || ''}
        </c38_municipioDestinatario>

      </guia>
    </GNRE>
  `).join('');

  return `
<TLote_GNRE
    xmlns="http://www.gnre.pe.gov.br"
    versao="${versaoLote}">

    ${xmlGuias}

</TLote_GNRE>`.trim();
}

function montarEnvelopeLote(guias = [], { ambiente = 'homologacao', versaoCabecalho = '1.00', versaoLote, versaoDados } = {}) {
  const env = ENDPOINTS[normalizarAmbiente(ambiente)];
  const vCab = versaoCabecalho || versaoDados || '1.00';
  const vLote = versaoLote || versaoDados || vCab;
  const loteXml = montarLoteGnreXml(guias, vLote);

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/wsdl/processar">
      <versaoDados>${xmlEscape(vCab)}</versaoDados>
    </gnreCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <gnreDadosMsg xmlns="${env.loteMsgNamespace}">${loteXml}</gnreDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function montarEnvelopeConsulta({ numeroRecibo, ambienteIdentificador = 2, ambiente = 'homologacao', versaoDados = '1.00' }) {
  const env = ENDPOINTS[normalizarAmbiente(ambiente)];

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/wsdl/consultar">
      <versaoDados>${xmlEscape(versaoDados)}</versaoDados>
    </gnreCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <gnreDadosMsg xmlns="${env.consultaAction}">
      <TConsLote_GNRE xmlns="http://www.gnre.pe.gov.br">
        <ambiente>${xmlEscape(ambienteIdentificador)}</ambiente>
        <numeroRecibo>${xmlEscape(somenteNumeros(numeroRecibo || ''))}</numeroRecibo>
      </TConsLote_GNRE>
    </gnreDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function headersLote(ambiente = 'homologacao') {
  const env = ENDPOINTS[normalizarAmbiente(ambiente)];
  return {
    'Content-Type': `application/soap+xml;charset=utf-8;action="${env.loteHeaderAction}"`,
    SOAPAction: 'processar',
  };
}

function headersConsulta(ambiente = 'homologacao') {
  const env = ENDPOINTS[normalizarAmbiente(ambiente)];
  return {
    'Content-Type': `application/soap+xml;charset=utf-8;action="${env.consultaAction}"`,
    SOAPAction: 'consultar',
  };
}

function doRequest({ url, xml, headers, pfx, passphrase, rejectUnauthorized = false, timeoutMs = 30000 }) {
  const body = Buffer.from(xml, 'utf-8');
  const alvo = new URL(url);

  const options = {
    hostname: alvo.hostname,
    port: alvo.port || 443,
    path: alvo.pathname,
    method: 'POST',
    pfx,
    passphrase,
    rejectUnauthorized,
    headers: {
      ...headers,
      'Content-Length': body.length,
    },
    timeout: timeoutMs,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf-8'),
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Timeout na requisicao GNRE')));

    req.write(body);
    req.end();
  });
}

class GnrePhpMirrorClient {
  constructor({ ambiente = 'homologacao', senhaCert = process.env.SENHA || '', certPfxBase64 = process.env.CERT_PFX_BASE64 || '', certPfxPath = process.env.CERT_PFX_PATH || '', rejectUnauthorized = false } = {}) {
    this.ambiente = normalizarAmbiente(ambiente);
    this.senhaCert = senhaCert;
    this.pfx = carregarPfx({ certPfxBase64, certPfxPath });
    this.rejectUnauthorized = rejectUnauthorized;
  }

  gerarXmlLote(guias = [], { versaoDados = '1.00', versaoCabecalho, versaoLote } = {}) {
    return montarEnvelopeLote(guias, { ambiente: this.ambiente, versaoDados, versaoCabecalho, versaoLote });
  }

  gerarXmlConsulta({ numeroRecibo, ambienteIdentificador, versaoDados = '1.00' }) {
    return montarEnvelopeConsulta({ numeroRecibo, ambienteIdentificador, ambiente: this.ambiente, versaoDados });
  }

  async enviarLote(guias = [], { versaoDados = '1.00', versaoCabecalho, versaoLote, timeoutMs = 30000 } = {}) {
    const env = ENDPOINTS[this.ambiente];
    const xml = this.gerarXmlLote(guias, { versaoDados, versaoCabecalho, versaoLote });

    return doRequest({
      url: env.loteUrl,
      xml,
      headers: headersLote(this.ambiente),
      pfx: this.pfx,
      passphrase: this.senhaCert,
      rejectUnauthorized: this.rejectUnauthorized,
      timeoutMs,
    });
  }

  async consultarLote({ numeroRecibo, ambienteIdentificador, versaoDados = '1.00', timeoutMs = 30000 }) {
    const env = ENDPOINTS[this.ambiente];
    const xml = this.gerarXmlConsulta({ numeroRecibo, ambienteIdentificador, versaoDados });

    return doRequest({
      url: env.consultaUrl,
      xml,
      headers: headersConsulta(this.ambiente),
      pfx: this.pfx,
      passphrase: this.senhaCert,
      rejectUnauthorized: this.rejectUnauthorized,
      timeoutMs,
    });
  }
}

export {
  ENDPOINTS,
  montarGuiaXml,
  montarLoteGnreXml,
  montarEnvelopeLote,
  montarEnvelopeConsulta,
  headersLote,
  headersConsulta,
  doRequest,
};

export default GnrePhpMirrorClient;
