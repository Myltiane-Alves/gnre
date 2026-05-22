/**
 * GnreController.js
 * Geração e envio de GNRE para a SEFAZ via SOAP 1.2
 *
 * Payload esperado da sua API (/api/venda/venda-gnre.xsjs):
 * {
 *   chave: '53260536769602005700550000000147921506192504',
 *   nnf: 14792,
 *   docEntry: 15405083,
 *   indFinal: 1,
 *   emitente: {
 *     CNPJ: '36.769.602/0057-00',
 *     xNome: 'GTO COMERCIO ATACADISTA...',
 *     state: 'DF',
 *     xLgr: 'SN',
 *     xMun: 'BRASÍLIA',
 *     CEP: '71.720-510',
 *     fone: null
 *   },
 *   destinatario: {
 *     CNPJ: '05.761.069/0001-51',
 *     xMun: 'SAO LUIS',
 *     UF: 'MA',
 *     indIEDest: '9',
 *     xNome: 'SOCIEDADE MARANHENSE DE DIREITOS HUMANOS'
 *   },
 *   valorNota: '179.980000'
 * }
 */

import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import 'dotenv/config';

// ─────────────────────────────────────────────────────────────────────────────
// Configurações
// ─────────────────────────────────────────────────────────────────────────────

const API_URL    = process.env.API_URL;
const SENHA_CERT = process.env.SENHA || '#GTO@2026#';
const AMBIENTE   = process.env.GNRE_AMBIENTE || 'homologacao'; // 'homologacao' | 'producao'

const ENDPOINTS = {
  homologacao: {
    recepcao       : 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao',
    consulta       : 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreResultadoLote',
    actionRecepcao : 'http://www.testegnre.pe.gov.br/webservice/GnreRecepcaoLote',
    actionConsulta : 'http://www.testegnre.pe.gov.br/webservice/GnreResultadoLote',
  },
  producao: {
    recepcao       : 'https://www.gnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao',
    consulta       : 'https://www.gnre.pe.gov.br/gnreWS/services/GnreResultadoLote',
    actionRecepcao : 'http://www.gnre.pe.gov.br/webservice/GnreRecepcaoLote',
    actionConsulta : 'http://www.gnre.pe.gov.br/webservice/GnreResultadoLote',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Tabela de alíquotas DIFAL por UF destino (2025/2026 — Lei 12.426/2024 e afins)
// Estrutura: { interna, fcp, interestadualDe: { Norte/NE/CO/ES: 7, Sul/SE: 12 } }
// A alíquota interestadual aplicada PELO EMITENTE é fixada pela UF de ORIGEM.
//   DF → qualquer UF Nordeste/Norte/CO/ES = 7%
//   DF → Sul/Sudeste (exceto ES)          = 12%
// ─────────────────────────────────────────────────────────────────────────────
const ALIQUOTAS_UF = {
  //         interna  fcp
  AC: { i: 0.19, fcp: 0.00 },
  AL: { i: 0.20, fcp: 0.00 },   // 19% + 1% FECOEP
  AP: { i: 0.18, fcp: 0.00 },
  AM: { i: 0.20, fcp: 0.00 },
  BA: { i: 0.205,fcp: 0.02 },   // 20,5% + 2% FUNCEP
  CE: { i: 0.20, fcp: 0.00 },
  DF: { i: 0.20, fcp: 0.00 },
  ES: { i: 0.17, fcp: 0.00 },
  GO: { i: 0.19, fcp: 0.00 },
  MA: { i: 0.23, fcp: 0.02 },   // 23% + 2% FECOP (Lei 12.426/2024)
  MT: { i: 0.17, fcp: 0.00 },
  MS: { i: 0.17, fcp: 0.00 },
  MG: { i: 0.18, fcp: 0.00 },
  PA: { i: 0.19, fcp: 0.00 },
  PB: { i: 0.20, fcp: 0.00 },
  PR: { i: 0.195,fcp: 0.00 },
  PE: { i: 0.205,fcp: 0.00 },
  PI: { i: 0.225,fcp: 0.00 },
  RJ: { i: 0.20, fcp: 0.02 },   // 20% + 2% FECP
  RN: { i: 0.20, fcp: 0.00 },
  RS: { i: 0.17, fcp: 0.00 },
  RO: { i: 0.195,fcp: 0.00 },
  RR: { i: 0.20, fcp: 0.00 },
  SC: { i: 0.17, fcp: 0.00 },
  SP: { i: 0.18, fcp: 0.00 },
  SE: { i: 0.19, fcp: 0.00 },
  TO: { i: 0.20, fcp: 0.00 },
};

// UFs que recebem alíquota interestadual de 7% das demais (Norte, NE, CO e ES)
const UF_ALIQUOTA_7 = new Set([
  'AC','AL','AP','AM','BA','CE','DF','GO','MA','MT','MS','PA','PB','PI','PE','RN','RO','RR','SE','TO',
]);

// Códigos de receita GNRE
const CODIGOS_RECEITA = {
  DIFAL  : '100102',  // ICMS Consumidor Final Não Contribuinte – EC 87/2015
  FCP    : '100120',  // Fundo de Combate à Pobreza (FCP/FECP)
  ICMS_ST: '100099',  // ICMS Substituição Tributária por operação
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const somenteNumeros = (v) => v ? String(v).replace(/\D/g, '') : '';
const fmt2 = (v) => parseFloat(v || 0).toFixed(2);

/** Formata data para YYYY-MM-DD (aceita Date, 'DD/MM/YYYY', 'YYYY-MM-DD') */
function fmtData(data) {
  if (!data) return '';
  if (data instanceof Date) return data.toISOString().split('T')[0];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [d, m, y] = data.split('/');
    return `${y}-${m}-${d}`;
  }
  return String(data).split('T')[0];
}

/** Último dia útil do mês corrente */
function vencimentoPadrao() {
  const hoje = new Date();
  const fim  = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const dow  = fim.getDay();
  if (dow === 0) fim.setDate(fim.getDate() - 2);
  if (dow === 6) fim.setDate(fim.getDate() - 1);
  return fmtData(fim);
}

function carregarCertificado() {
  const valorEnvPfxPath = String(process.env.CERT_PFX_PATH || '').trim();
  const valorEnvPfxBase64 = String(process.env.CERT_PFX_BASE64 || '').trim();

  const limparAspas = (valor = '') => String(valor).replace(/^['\"]|['\"]$/g, '').trim();

  const tentarBase64 = (valor = '') => {
    const limpo = limparAspas(valor).replace(/\s+/g, '');
    if (!limpo) return null;

    // Evita interpretar caminhos comuns como Base64.
    const pareceCaminho =
      /^[a-zA-Z]:\\/.test(limpo) ||
      /^\\\\/.test(limpo) ||
      /^\.{1,2}[\\/]/.test(limpo) ||
      /^\//.test(limpo) ||
      /\.pfx$/i.test(limpo);
    if (pareceCaminho) return null;

    if (!/^[A-Za-z0-9+/=]+$/.test(limpo) || limpo.length < 64) {
      return null;
    }

    try {
      const buffer = Buffer.from(limpo, 'base64');
      if (buffer.length > 0) {
        console.log('[GNRE] Certificado carregado via Base64 no .env');
        return buffer;
      }
    } catch (_) {
      return null;
    }

    return null;
  };

  const pfxBase64 = tentarBase64(valorEnvPfxBase64) || tentarBase64(valorEnvPfxPath);
  if (pfxBase64) {
    return pfxBase64;
  }

  const caminhos = [
    limparAspas(valorEnvPfxPath),
    './GTO COMERCIO 2026-2027.pfx',
    './certs/GTO COMERCIO 2026-2027.pfx',
    './src/certs/GTO COMERCIO 2026-2027.pfx',
  ].filter(Boolean);

  for (const caminho of caminhos) {
    const abs = path.resolve(caminho);
    if (fs.existsSync(abs)) {
      console.log('[GNRE] Certificado carregado via arquivo:', abs);
      return fs.readFileSync(abs);
    }
  }

  throw new Error('[GNRE] Certificado PFX não encontrado. Defina CERT_PFX_PATH (arquivo) ou CERT_PFX_BASE64 no .env');
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo DIFAL + FCP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula DIFAL e FCP para uma operação interestadual com consumidor final.
 *
 * Fórmula padrão (por fora / base única — regra geral do MA):
 *   DIFAL = base × (alíquotaInterna - alíquotaInterestadual)
 *   FCP   = base × alíquotaFCP
 *
 * @param {number} valorBase         - valor da NF-e (valorNota)
 * @param {string} ufOrigem          - UF do emitente  (ex: 'DF')
 * @param {string} ufDestino         - UF do destino   (ex: 'MA')
 * @returns {{ difal: number, fcp: number, aliqInterestadual: number, aliqInterna: number, aliqFCP: number }}
 */
function calcularDIFAL(valorBase, ufOrigem, ufDestino) {
  const destConfig = ALIQUOTAS_UF[ufDestino.toUpperCase()];
  if (!destConfig) throw new Error(`UF destino desconhecida: ${ufDestino}`);

  // Alíquota interestadual aplicada pela UF de ORIGEM em direção ao destino
  const aliqInterestadual = UF_ALIQUOTA_7.has(ufOrigem.toUpperCase()) ? 0.07 : 0.12;

  const aliqInterna = destConfig.i;
  const aliqFCP     = destConfig.fcp;

  const base  = parseFloat(valorBase);
  const difal = parseFloat((base * (aliqInterna - aliqInterestadual)).toFixed(2));
  const fcp   = parseFloat((base * aliqFCP).toFixed(2));

  return { difal, fcp, aliqInterestadual, aliqInterna, aliqFCP };
}

// ─────────────────────────────────────────────────────────────────────────────
// Montagem do XML de cada guia TDadosGNRE
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// Envelope SOAP
// ─────────────────────────────────────────────────────────────────────────────

function montarGuiaXml(g) {
  const idEmitente     = g.tipoIdentEmitente === '2'
    ? somenteNumeros(g.cpfEmitente)
    : somenteNumeros(g.cnpjEmitente);

  const idDestinatario = g.tipoIdentDestinatario === '2'
    ? somenteNumeros(g.cpfDestinatario)
    : somenteNumeros(g.cnpjDestinatario);

  const sanitizar = (v) => {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};
  const hoje = new Date();
  const mes  = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano  = hoje.getFullYear();

  const linhas = [
    `<TDadosGNRE>`,
    `<c01_UfFavorecida>${g.ufFavorecida.toUpperCase()}</c01_UfFavorecida>`,
    `<c02_receita>${g.codigoReceita}</c02_receita>`,
    `<c27_tipoIdentificacaoEmitente>${g.tipoIdentEmitente}</c27_tipoIdentificacaoEmitente>`,
    `<c03_idContribuinteEmitente>${idEmitente}</c03_idContribuinteEmitente>`,
    `<c28_tipoDocOrigem>${g.tipoDocOrigem}</c28_tipoDocOrigem>`,
    `<c04_docOrigem>${somenteNumeros(g.docOrigem)}</c04_docOrigem>`,
    `<c05_referencia><mes>${mes}</mes><ano>${ano}</ano></c05_referencia>`,
    `<c06_valorPrincipal>${fmt2(g.valorPrincipal)}</c06_valorPrincipal>`,
    `<c10_valorTotal>${fmt2(g.valorTotal ?? g.valorPrincipal)}</c10_valorTotal>`,
    `<c14_dataVencimento>${fmtData(g.dataVencimento) || vencimentoPadrao()}</c14_dataVencimento>`,
    `<c16_razaoSocialEmitente>${sanitizar(g.razaoSocialEmitente)}</c16_razaoSocialEmitente>`,
    g.inscricaoEstadualEmitente
      ? `<c17_inscricaoEstadualEmitente>${somenteNumeros(g.inscricaoEstadualEmitente)}</c17_inscricaoEstadualEmitente>`
      : null,
    g.enderecoEmitente  ? `<c18_enderecoEmitente>${sanitizar(g.enderecoEmitente)}</c18_enderecoEmitente>`   : null,
    g.municipioEmitente ? `<c19_municipioEmitente>${sanitizar(g.municipioEmitente)}</c19_municipioEmitente>` : null,
    `<c20_ufEnderecoEmitente>${(g.ufEnderecoEmitente || '').toUpperCase()}</c20_ufEnderecoEmitente>`,
    somenteNumeros(g.cepEmitente) ? `<c21_cepEmitente>${somenteNumeros(g.cepEmitente)}</c21_cepEmitente>` : null,
    somenteNumeros(g.telefoneEmitente || '') ? `<c22_telefoneEmitente>${somenteNumeros(g.telefoneEmitente)}</c22_telefoneEmitente>` : null,
    `<c34_tipoIdentificacaoDestinatario>${g.tipoIdentDestinatario}</c34_tipoIdentificacaoDestinatario>`,
    `<c35_idContribuinteDestinatario>${idDestinatario}</c35_idContribuinteDestinatario>`,
    g.inscricaoEstadualDestinatario
      ? `<c36_inscricaoEstadualDestinatario>${somenteNumeros(g.inscricaoEstadualDestinatario)}</c36_inscricaoEstadualDestinatario>`
      : null,
    g.razaoSocialDestinatario ? `<c37_razaoSocialDestinatario>${sanitizar(g.razaoSocialDestinatario)}</c37_razaoSocialDestinatario>` : null,
    g.municipioDestinatario   ? `<c38_municipioDestinatario>${sanitizar(g.municipioDestinatario)}</c38_municipioDestinatario>`       : null,
    `</TDadosGNRE>`,
  ].filter(Boolean);

  return linhas.join('\n');
}

function montarSoapEnvelope(guiasXml, ambiente = 'homologacao') {

  const NS_PROCESSAR = 'http://www.gnre.pe.gov.br/wsdl/processar';
  const NS_GNRE = 'http://www.gnre.pe.gov.br';

  const ambienteNum = ambiente === 'producao' ? '1' : '2';

  const guias = guiasXml.join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
    <soapenv:Envelope
        xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:xsd="http://www.w3.org/2001/XMLSchema">

        <soapenv:Header>
            <gnreCabecMsg xmlns="${NS_PROCESSAR}">
          <versaoDados>2.00</versaoDados>
            <ambienteIdentificador>${ambienteNum}</ambienteIdentificador>
            </gnreCabecMsg>
        </soapenv:Header>
        <soapenv:Body>
            <processar xmlns="${NS_PROCESSAR}">
                <gnreDadosMsg><![CDATA[
              <TLote_GNRE versao="2.00" xmlns="${NS_GNRE}">
              <guias>
                        ${guias}
                    </guias>
                    </TLote_GNRE>
                ]]></gnreDadosMsg>
            </processar>
        </soapenv:Body>
    </soapenv:Envelope>`;
}
// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento da venda → guias GNRE
// Totalmente adaptado ao payload real da sua API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte o objeto `venda` retornado pela API em um array de objetos-guia.
 *
 * Regras aplicadas automaticamente:
 *   • indFinal === 1 → consumidor final não contribuinte → gera DIFAL (+ FCP se houver)
 *   • indIEDest === '9' → sem IE → confirma consumidor final
 *   • Alíquota interestadual definida pela UF de origem (DF → Nordeste = 7%)
 *   • FCP gerado como guia separada quando alíquota FCP do destino > 0
 */
function mapearVendaParaGuias(venda) {
  const { chave, indFinal, emitente, destinatario, valorNota } = venda;

  const ufOrigem  = (emitente.state || emitente.UF || '').toUpperCase();
  const ufDestino = (destinatario.UF || '').toUpperCase();
  const base      = parseFloat(valorNota);

  // ── Dados comuns a todas as guias do lote ─────────────────────────────────
  const dadosComuns = {
    // Emitente
    tipoIdentEmitente        : '1',            // CNPJ
    cnpjEmitente             : emitente.CNPJ,
    razaoSocialEmitente      : emitente.xNome,
    inscricaoEstadualEmitente: '',             // DF optante do Simples pode não ter IE estadual
    enderecoEmitente         : emitente.xLgr || '',
    municipioEmitente        : emitente.xMun  || '',
    ufEnderecoEmitente       : ufOrigem,
    cepEmitente              : emitente.CEP   || '',
    telefoneEmitente         : emitente.fone  || '',

    // Destinatário
    tipoIdentDestinatario         : '1',       // CNPJ (mesmo sem IE é CNPJ)
    cnpjDestinatario              : destinatario.CNPJ,
    razaoSocialDestinatario       : destinatario.xNome,
    inscricaoEstadualDestinatario : '',        // indIEDest=9 → não contribuinte, sem IE
    municipioDestinatario         : destinatario.xMun || '',

    // Documento de origem
    tipoDocOrigem : '10',                      // 10 = NF-e modelo 55
    docOrigem     : chave,

    // Datas
    dataVencimento: vencimentoPadrao(),

    // UF favorecida
    ufFavorecida : ufDestino,
  };

  const guias = [];

  // ── Consumidor final não contribuinte (indFinal=1 / indIEDest=9) ──────────
  const isConsumidorFinal = indFinal === 1 || destinatario.indIEDest === '9';

  if (isConsumidorFinal) {
    const { difal, fcp, aliqInterestadual, aliqInterna, aliqFCP } =
      calcularDIFAL(base, ufOrigem, ufDestino);

    console.log(
      `[GNRE] Cálculo DIFAL: base=${fmt2(base)} | ` +
      `aliqInterest=${(aliqInterestadual * 100).toFixed(1)}% | ` +
      `aliqInterna=${(aliqInterna * 100).toFixed(1)}% | ` +
      `DIFAL=R$${fmt2(difal)} | FCP=${(aliqFCP * 100).toFixed(1)}% → R$${fmt2(fcp)}`
    );

    // Guia 1 — DIFAL
    if (difal > 0) {
      guias.push({
        ...dadosComuns,
        codigoReceita : CODIGOS_RECEITA.DIFAL,
        valorPrincipal: difal,
        valorTotal    : difal,
      });
    }

    // Guia 2 — FCP (guia separada, código próprio)
    if (fcp > 0) {
      guias.push({
        ...dadosComuns,
        codigoReceita : CODIGOS_RECEITA.FCP,
        valorPrincipal: fcp,
        valorTotal    : fcp,
      });
    }
  }

  // ── Aqui você pode adicionar mais blocos para ICMS-ST se necessário ───────
  // if (venda.valorST && parseFloat(venda.valorST) > 0) { ... }

  return guias;
}

// ─────────────────────────────────────────────────────────────────────────────
// Envio SOAP com certificado mTLS (PFX)
// ─────────────────────────────────────────────────────────────────────────────

async function enviarSoap(xmlEnvelope, ambiente = 'homologacao') {
  const ep  = ENDPOINTS[ambiente];
  const pfx = carregarCertificado();

  const xmlBuf = Buffer.from(xmlEnvelope, 'utf-8');

  const url    = new URL(ep.recepcao);
 const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'POST',
  pfx,
  passphrase: SENHA_CERT,
  rejectUnauthorized: false,

  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': ep.actionRecepcao,
    'Content-Length': xmlBuf.length,
  },
};

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        console.log('[GNRE] Status HTTP:', res.statusCode);
        console.log('[GNRE] Resposta:\n', body);
        // Resolve mesmo em 500 para capturar o XML de erro completo
        resolve(body);
      });
    });

    req.on('error', reject);

    console.log('[GNRE] Enviando', xmlBuf.length, 'bytes para', ep.recepcao);
    req.write(xmlBuf);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse da resposta XML da SEFAZ
// ─────────────────────────────────────────────────────────────────────────────

function parseResposta(xmlResposta) {
  try {
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const obj    = parser.parse(xmlResposta);
    const body   = obj?.Envelope?.Body;

    // Suporta tanto gnreRetMsg quanto processarResponse
    const ret = body?.gnreRetMsg?.TRetLote_GNRE
             ?? body?.processarResponse?.TRetLote_GNRE;

    if (!ret) return { sucesso: false, erro: 'Estrutura de resposta inesperada', raw: xmlResposta };

    const codigoSituacao = ret?.situacaoRecepcao?.codigo;
    const sucesso = ['1', '100', 1, 100].includes(codigoSituacao);

    const guiasRaw = ret?.guias?.TDadosGNRE;
    const guias    = guiasRaw
      ? (Array.isArray(guiasRaw) ? guiasRaw : [guiasRaw])
      : [];

    return {
      sucesso,
      situacao   : ret?.situacaoRecepcao,
      ambiente   : ret?.ambiente,
      numeroLote : ret?.numeroLote,
      dataRecibo : ret?.dataRecibo,
      guias,
    };
  } catch (e) {
    return { sucesso: false, erro: e.message, raw: xmlResposta };
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// Consulta de lote
// ─────────────────────────────────────────────────────────────────────────────

async function consultarLoteSefaz(numeroRecibo, ambiente = 'homologacao') {
  const ep  = ENDPOINTS[ambiente];
  const pfx = carregarCertificado();

  const xml = `
  <?xml version="1.0" encoding="UTF-8"?>
    <soap12:Envelope
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:xsd="http://www.w3.org/2001/XMLSchema"
      xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
        <soap12:Header>
            <gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/wsdl/consultar">
            <versaoDados>2.00</versaoDados>
            </gnreCabecMsg>
        </soap12:Header>
        <soap12:Body>
            <gnreDadosMsg xmlns="${ep.actionConsulta}">
            <TConsLote_GNRE xmlns="http://www.gnre.pe.gov.br">
                <numero>${numeroRecibo}</numero>
            </TConsLote_GNRE>
            </gnreDadosMsg>
        </soap12:Body>
    </soap12:Envelope>
`;

  const agent = new https.Agent({ pfx, passphrase: SENHA_CERT, rejectUnauthorized: false });
  const xmlLength = Buffer.byteLength(xml, 'utf-8');

  const response = await axios.post(ep.consulta, xml, {
    headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': ep.actionConsulta,
    'Content-Length': xmlLength,
    },
    httpsAgent: agent,
    timeout   : 30_000,
  });

  return response.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────────────────────────────────────

class GnreController {


  async gerarGnre(req, res) {
    try {
      const { idVenda } = req.query;
      if (!idVenda) return res.status(400).json({ success: false, message: 'idVenda obrigatório' });

      // 1. Busca venda na sua API
      const { data: responseData } = await axios.get(
        `${API_URL}/api/venda/venda-gnre.xsjs?docEntry=${idVenda}`
      );
      const venda = responseData?.data?.[0]?.venda;
      if (!venda) return res.status(404).json({ success: false, message: 'Venda não encontrada' });

      // 2. Valida se a UF de destino é atendida pelo portal GNRE-PE
      //    SP e ES têm portais próprios — não use este endpoint para eles
      const ufDest = (venda.destinatario?.UF || '').toUpperCase();
      if (['SP', 'ES'].includes(ufDest)) {
        return res.status(422).json({
          success: false,
          message: `UF ${ufDest} não é atendida pelo portal GNRE-PE. Use o portal estadual específico.`,
        });
      }

      // 3. Mapeia venda → guias
      const dadosGuias = mapearVendaParaGuias(venda);
      if (dadosGuias.length === 0) {
        return res.status(422).json({
          success: false,
          message: 'Nenhum imposto interestadual identificado (DIFAL/FCP/ICMS-ST)',
        });
      }

      // 4. Monta XMLs
      const guiasXml    = dadosGuias.map(montarGuiaXml);
      const envelopeXml = montarSoapEnvelope(guiasXml, AMBIENTE);

      console.log('[GNRE] Envelope XML:\n', envelopeXml);

      // 5. Envia para SEFAZ
      const respostaSefaz = await enviarSoap(envelopeXml, AMBIENTE);
      console.log('[GNRE] Resposta SEFAZ:\n', respostaSefaz);

      // 6. Parseia e retorna
      const resultado = parseResposta(respostaSefaz);

      return res.status(resultado.sucesso ? 200 : 422).json({
        success    : resultado.sucesso,
        numeroLote : resultado.numeroLote,
        dataRecibo : resultado.dataRecibo,
        situacao   : resultado.situacao,
        guias      : resultado.guias,
        calculo    : dadosGuias.map(g => ({
          tipo           : g.codigoReceita === CODIGOS_RECEITA.DIFAL ? 'DIFAL' : 'FCP',
          codigoReceita  : g.codigoReceita,
          ufFavorecida   : g.ufFavorecida,
          valorPrincipal : g.valorPrincipal,
        })),
        // Remova os campos abaixo em produção
        _debug: {
          xmlEnviado  : envelopeXml,
          xmlResposta : respostaSefaz,
        },
      });

    } catch (error) {
      console.error('[GNRE] Erro:', error?.response?.data || error.message);
      return res.status(500).json({
        success : false,
        message : error?.response?.data || error.message,
        stack   : error.stack,
      });
    }
  }


  async consultarLote(req, res) {
    try {
      const { numeroLote } = req.query;
      if (!numeroLote) return res.status(400).json({ success: false, message: 'numeroLote obrigatório' });

      const respostaSefaz = await consultarLoteSefaz(numeroLote, AMBIENTE);
      const resultado     = parseResposta(respostaSefaz);

      return res.status(200).json({
        success    : resultado.sucesso,
        situacao   : resultado.situacao,
        guias      : resultado.guias,
        xmlResposta: respostaSefaz,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error?.response?.data || error.message });
    }
  }


  async previewXml(req, res) {
    try {
      const { idVenda } = req.query;
      const { data: responseData } = await axios.get(
        `${API_URL}/api/venda/venda-gnre.xsjs?docEntry=${idVenda}`
      );
      const venda = responseData?.data?.[0]?.venda;
      if (!venda) return res.status(404).json({ success: false, message: 'Venda não encontrada' });

      const dadosGuias  = mapearVendaParaGuias(venda);
      const guiasXml    = dadosGuias.map(montarGuiaXml);
      const envelopeXml = montarSoapEnvelope(guiasXml, AMBIENTE);

      // Retorna também o resumo do cálculo em JSON (conveniente para debug)
      if (req.query.formato === 'json') {
        return res.status(200).json({
          success : true,
          calculo : dadosGuias.map(g => ({
            tipo           : g.codigoReceita === CODIGOS_RECEITA.DIFAL ? 'DIFAL' : 'FCP',
            codigoReceita  : g.codigoReceita,
            ufFavorecida   : g.ufFavorecida,
            valorPrincipal : g.valorPrincipal,
            dataVencimento : g.dataVencimento,
          })),
          xmlEnvelope: envelopeXml,
        });
      }

      res.set('Content-Type', 'application/xml');
      return res.status(200).send(envelopeXml);

    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default GnreController;

// Exporta utilitários para testes unitários
export { mapearVendaParaGuias, calcularDIFAL, montarGuiaXml, montarSoapEnvelope, parseResposta, CODIGOS_RECEITA, ALIQUOTAS_UF };