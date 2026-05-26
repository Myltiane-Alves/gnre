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

const API_URL = process.env.API_URL;
const SENHA_CERT = process.env.SENHA || '#GTO@2026#';
const AMBIENTE = 'homologacao'; // ambiente fixo para testes

const ENDPOINTS = {
  homologacao: {
    recepcao: 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao',
    consulta: 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreResultadoLote',
    actionRecepcao: 'http://www.testegnre.pe.gov.br/webservice/GnreRecepcaoLote',
    nsRecepcao: 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao',
    actionProcessar: 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao/processar',
    actionConsulta: 'http://www.testegnre.pe.gov.br/webservice/GnreResultadoLote',
  },
  producao: {
    recepcao: 'https://www.gnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao',
    consulta: 'https://www.gnre.pe.gov.br/gnreWS/services/GnreResultadoLote',
    actionRecepcao: 'http://www.gnre.pe.gov.br/webservice/GnreRecepcaoLote',
    nsRecepcao: 'http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao',
    actionProcessar: 'http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao/processar',
    actionConsulta: 'http://www.gnre.pe.gov.br/webservice/GnreResultadoLote',
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
  BA: { i: 0.205, fcp: 0.02 },   // 20,5% + 2% FUNCEP
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
  PR: { i: 0.195, fcp: 0.00 },
  PE: { i: 0.205, fcp: 0.00 },
  PI: { i: 0.225, fcp: 0.00 },
  RJ: { i: 0.20, fcp: 0.02 },   // 20% + 2% FECP
  RN: { i: 0.20, fcp: 0.00 },
  RS: { i: 0.17, fcp: 0.00 },
  RO: { i: 0.195, fcp: 0.00 },
  RR: { i: 0.20, fcp: 0.00 },
  SC: { i: 0.17, fcp: 0.00 },
  SP: { i: 0.18, fcp: 0.00 },
  SE: { i: 0.19, fcp: 0.00 },
  TO: { i: 0.20, fcp: 0.00 },
};

// UFs que recebem alíquota interestadual de 7% das demais (Norte, NE, CO e ES)
const UF_ALIQUOTA_7 = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'GO', 'MA', 'MT', 'MS', 'PA', 'PB', 'PI', 'PE', 'RN', 'RO', 'RR', 'SE', 'TO',
]);

// Códigos de receita GNRE
const CODIGOS_RECEITA = {
  DIFAL: '100102',  // ICMS Consumidor Final Não Contribuinte – EC 87/2015
  FCP: '100120',  // Fundo de Combate à Pobreza (FCP/FECP)
  ICMS_ST: '100099',  // ICMS Substituição Tributária por operação
};

const UF_CODIGO_IBGE = {
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29', CE: '23', DF: '53', ES: '32', GO: '52', MA: '21',
  MG: '31', MS: '50', MT: '51', PA: '15', PB: '25', PE: '26', PI: '22', PR: '41', RJ: '33', RN: '24',
  RO: '11', RR: '14', RS: '43', SC: '42', SE: '28', SP: '35', TO: '17'
};

const MUNICIPIO_CODIGO_GNRE = {
  BRASILIA: '53001',
  'SAO LUIS': '21113',
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
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const dow = fim.getDay();
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
  const aliqFCP = destConfig.fcp;

  const base = parseFloat(valorBase);
  const difal = parseFloat((base * (aliqInterna - aliqInterestadual)).toFixed(2));
  const fcp = parseFloat((base * aliqFCP).toFixed(2));

  return { difal, fcp, aliqInterestadual, aliqInterna, aliqFCP };
}

// ─────────────────────────────────────────────────────────────────────────────
// Montagem do XML de cada guia TDadosGNRE
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// Envelope SOAP
// ─────────────────────────────────────────────────────────────────────────────

function montarGuiaXml(g) {
  const idEmitente = g.tipoIdentEmitente === '2'
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
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();

  const linhas = [
    `<TDadosGNRE>`,
    `<c01_UfFavorecida>${UF_CODIGO_IBGE[(g.ufFavorecida || '').toUpperCase()] || (g.ufFavorecida || '').toUpperCase()}</c01_UfFavorecida>`,
    `<c02_receita>${g.codigoReceita}</c02_receita>`,
    `<c27_tipoIdentificacaoEmitente>${g.tipoIdentEmitente}</c27_tipoIdentificacaoEmitente>`,
    g.tipoIdentEmitente === '2'
      ? `<c03_idContribuinteEmitente><CPF>${idEmitente}</CPF></c03_idContribuinteEmitente>`
      : `<c03_idContribuinteEmitente><CNPJ>${idEmitente}</CNPJ></c03_idContribuinteEmitente>`,
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
    g.enderecoEmitente ? `<c18_enderecoEmitente>${sanitizar(g.enderecoEmitente)}</c18_enderecoEmitente>` : null,
    /^\d+$/.test(String(g.municipioEmitente || ''))
      ? `<c19_municipioEmitente>${String(g.municipioEmitente)}</c19_municipioEmitente>`
      : null,
    `<c20_ufEnderecoEmitente>${(g.ufEnderecoEmitente || '').toUpperCase()}</c20_ufEnderecoEmitente>`,
    somenteNumeros(g.cepEmitente) ? `<c21_cepEmitente>${somenteNumeros(g.cepEmitente)}</c21_cepEmitente>` : null,
    somenteNumeros(g.telefoneEmitente || '') ? `<c22_telefoneEmitente>${somenteNumeros(g.telefoneEmitente)}</c22_telefoneEmitente>` : null,
    `<c34_tipoIdentificacaoDestinatario>${g.tipoIdentDestinatario}</c34_tipoIdentificacaoDestinatario>`,
    g.tipoIdentDestinatario === '2'
      ? `<c35_idContribuinteDestinatario><CPF>${idDestinatario}</CPF></c35_idContribuinteDestinatario>`
      : `<c35_idContribuinteDestinatario><CNPJ>${idDestinatario}</CNPJ></c35_idContribuinteDestinatario>`,
    g.inscricaoEstadualDestinatario
      ? `<c36_inscricaoEstadualDestinatario>${somenteNumeros(g.inscricaoEstadualDestinatario)}</c36_inscricaoEstadualDestinatario>`
      : null,
    g.razaoSocialDestinatario ? `<c37_razaoSocialDestinatario>${sanitizar(g.razaoSocialDestinatario)}</c37_razaoSocialDestinatario>` : null,
    /^\d+$/.test(String(g.municipioDestinatario || ''))
      ? `<c38_municipioDestinatario>${String(g.municipioDestinatario)}</c38_municipioDestinatario>`
      : null,
    `</TDadosGNRE>`,
  ].filter(Boolean);

  return linhas.join('\n');
}

function montarLoteXmlV2(guias = []) {
  const sanitizar = (v) => String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const codigoMunicipio = (valor = '') => {
    const texto = String(valor || '').trim();
    if (!texto) return '';
    const apenasNum = texto.replace(/\D/g, '');
    if (apenasNum) return apenasNum.slice(0, 7);

    const chave = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    return MUNICIPIO_CODIGO_GNRE[chave] || '';
  };

  const guiasXml = guias.map((g, idx) => {
    const idEmitente = g.tipoIdentEmitente === '2'
      ? `<CPF>${somenteNumeros(g.cpfEmitente)}</CPF>`
      : `<CNPJ>${somenteNumeros(g.cnpjEmitente)}</CNPJ>`;

    const idDestinatario = g.tipoIdentDestinatario === '2'
      ? `<CPF>${somenteNumeros(g.cpfDestinatario)}</CPF>`
      : `<CNPJ>${somenteNumeros(g.cnpjDestinatario)}</CNPJ>`;

    const referencia = fmtData(g.dataVencimento) || vencimentoPadrao();
    const dataPagamento = fmtData(new Date());
    const [ano, mes] = referencia.split('-');
    const codMunEmit = codigoMunicipio(g.municipioEmitente);
    const codMunDest = codigoMunicipio(g.municipioDestinatario);

    return `<TDadosGNRE versao="2.00">
      <ufFavorecida>${(g.ufFavorecida || '').toUpperCase()}</ufFavorecida>
      <tipoGnre>0</tipoGnre>
      <contribuinteEmitente>
        <identificacao>${idEmitente}</identificacao>
        <razaoSocial>${sanitizar(g.razaoSocialEmitente)}</razaoSocial>
        ${g.enderecoEmitente ? `<endereco>${sanitizar(g.enderecoEmitente)}</endereco>` : ''}
        ${codMunEmit ? `<municipio>${codMunEmit}</municipio>` : ''}
        <uf>${(g.ufEnderecoEmitente || '').toUpperCase()}</uf>
        ${somenteNumeros(g.cepEmitente) ? `<cep>${somenteNumeros(g.cepEmitente)}</cep>` : ''}
      </contribuinteEmitente>
      <itensGNRE>
        <item>
          <receita>${String(g.codigoReceita || '').replace(/\D/g, '').slice(0, 6).padStart(6, '0')}</receita>
          <documentoOrigem tipo="10">${somenteNumeros(g.docOrigem)}</documentoOrigem>
          <referencia>
            <periodo>0</periodo>
            <mes>${String(mes || '').padStart(2, '0')}</mes>
            <ano>${String(ano || '').slice(0, 4)}</ano>
          </referencia>
          <dataVencimento>${referencia}</dataVencimento>
          <valor tipo="11">${fmt2(g.valorPrincipal)}</valor>
          <valor tipo="21">${fmt2(g.valorTotal ?? g.valorPrincipal)}</valor>
          <contribuinteDestinatario>
            <identificacao>${idDestinatario}</identificacao>
            <razaoSocial>${sanitizar(g.razaoSocialDestinatario)}</razaoSocial>
            ${codMunDest ? `<municipio>${codMunDest}</municipio>` : ''}
          </contribuinteDestinatario>
        </item>
      </itensGNRE>
      <valorGNRE>${fmt2(g.valorTotal ?? g.valorPrincipal)}</valorGNRE>
      <dataPagamento>${dataPagamento}</dataPagamento>
      <identificadorGuia>${idx + 1}</identificadorGuia>
    </TDadosGNRE>`;
  });

  return `<TLote_GNRE versao="2.00" xmlns="http://www.gnre.pe.gov.br">
  <guias>
${guiasXml.join('\n')}
  </guias>
</TLote_GNRE>`;
}

function montarSoapEnvelope(guiasDados = []) {

  const loteXml = montarLoteXmlV2(guiasDados);

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
 xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">

    <soapenv:Header>

        <gnreCabecMsg
         xmlns="http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao">

            <versaoDados>2.00</versaoDados>

        </gnreCabecMsg>

    </soapenv:Header>

    <soapenv:Body>

        <gnreDadosMsg
         xmlns="http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao">

            ${loteXml}

        </gnreDadosMsg>

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

  const ufOrigem = (emitente.state || emitente.UF || '').toUpperCase();
  const ufDestino = (destinatario.UF || '').toUpperCase();
  const base = parseFloat(valorNota);

  // ── Dados comuns a todas as guias do lote ─────────────────────────────────
  const dadosComuns = {
    // Emitente
    tipoIdentEmitente: '1',            // CNPJ
    cnpjEmitente: emitente.CNPJ,
    razaoSocialEmitente: emitente.xNome,
    inscricaoEstadualEmitente: '',             // DF optante do Simples pode não ter IE estadual
    enderecoEmitente: emitente.xLgr || '',
    municipioEmitente: emitente.xMun || '',
    ufEnderecoEmitente: ufOrigem,
    cepEmitente: emitente.CEP || '',
    telefoneEmitente: emitente.fone || '',

    // Destinatário
    tipoIdentDestinatario: '1',       // CNPJ (mesmo sem IE é CNPJ)
    cnpjDestinatario: destinatario.CNPJ,
    razaoSocialDestinatario: destinatario.xNome,
    inscricaoEstadualDestinatario: '',        // indIEDest=9 → não contribuinte, sem IE
    municipioDestinatario: destinatario.xMun || '',

    // Documento de origem
    tipoDocOrigem: '10',                      // 10 = NF-e modelo 55
    docOrigem: chave,

    // Datas
    dataVencimento: vencimentoPadrao(),

    // UF favorecida
    ufFavorecida: ufDestino,
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
        codigoReceita: CODIGOS_RECEITA.DIFAL,
        valorPrincipal: difal,
        valorTotal: difal,
      });
    }

    // Guia 2 — FCP (guia separada, código próprio)
    if (fcp > 0) {
      guias.push({
        ...dadosComuns,
        codigoReceita: CODIGOS_RECEITA.FCP,
        valorPrincipal: fcp,
        valorTotal: fcp,
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

  const ep = ENDPOINTS[ambiente];
  const pfx = carregarCertificado();

  const xmlBuf = Buffer.from(xmlEnvelope, 'utf-8');

  const headers = {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': '"processar"',
    'Content-Length': xmlBuf.length,
  };

  const url = new URL(ep.recepcao);

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: 'POST',

    pfx,
    passphrase: SENHA_CERT,

    rejectUnauthorized: false,

    headers,
  };

  return new Promise((resolve, reject) => {

    const req = https.request(options, (res) => {

      const chunks = [];

      res.on('data', (c) => chunks.push(c));

      res.on('end', () => {

        const body = Buffer.concat(chunks).toString('utf-8');

        resolve({
          statusCode: res.statusCode,
          body
        });

      });

    });

    req.on('error', reject);

    req.write(xmlBuf);

    req.end();

  });

}

// ─────────────────────────────────────────────────────────────────────────────
// Parse da resposta XML da SEFAZ
// ─────────────────────────────────────────────────────────────────────────────

function apenasDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

function primeiroValor(obj, chaves = []) {
  for (const chave of chaves) {
    const valor = obj?.[chave];
    if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
      return valor;
    }
  }
  return null;
}

function normalizarGuiaRetorno(guia = {}) {
  const numeroDocumento = primeiroValor(guia, [
    'c41_numeroControle',
    'numeroControle',
    'nossoNumero'
  ]);

  const linhaDigitavel = primeiroValor(guia, [
    'linhaDigitavel',
    'representacaoNumerica'
  ]);

  const codigoBarras = primeiroValor(guia, ['codigoBarras']);

  return {
    ...guia,
    numeroDocumento: apenasDigitos(numeroDocumento),
    linhaDigitavel: apenasDigitos(linhaDigitavel),
    codigoBarras: apenasDigitos(codigoBarras)
  };
}

function parseResposta(xmlResposta) {

  try {

    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true
    });

    const obj = parser.parse(xmlResposta);

    const ret =
      obj?.Envelope?.Body?.processarResponse?.TRetLote_GNRE;

    if (!ret) {

      return {
        sucesso: false,
        erro: 'Estrutura inválida',
        raw: xmlResposta
      };

    }

    return {
      sucesso: true,

      ambiente: ret?.ambiente,

      situacao: ret?.situacaoRecepcao,

      recibo: ret?.recibo,

      raw: obj
    };

  } catch (e) {

    return {
      sucesso: false,
      erro: e.message,
      raw: xmlResposta
    };

  }

}

function diagnosticarEnvelope(xml = '') {
  const versaoDados = (String(xml).match(/<\s*versaoDados\s*>\s*([^<]+)\s*<\s*\/\s*versaoDados\s*>/i) || [])[1] || null;
  const versaoLote = (String(xml).match(/<\s*(?:\w+:)?TLote_GNRE\b[^>]*\bversao\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
  const versaoDadosGuia = (String(xml).match(/<\s*(?:\w+:)?TDadosGNRE\b[^>]*\bversao\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
  const namespaceCabecalho = (String(xml).match(/<\s*gnreCabecMsg\s+xmlns\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
  const namespaceCorpo = (String(xml).match(/<\s*soap12:Envelope\b[^>]*\bxmlns:gnre\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
  const temLayoutCxx = /<\s*c01_UfFavorecida\s*>/i.test(String(xml));
  const temLayoutV2 = /<\s*ufFavorecida\s*>/i.test(String(xml)) && /<\s*itensGNRE\s*>/i.test(String(xml));

  return {
    versaoDados: versaoDados ? String(versaoDados).trim() : null,
    versaoLote: versaoLote ? String(versaoLote).trim() : null,
    versaoDadosGuia: versaoDadosGuia ? String(versaoDadosGuia).trim() : null,
    namespaceCabecalho: namespaceCabecalho ? String(namespaceCabecalho).trim() : null,
    namespaceCorpo: namespaceCorpo ? String(namespaceCorpo).trim() : null,
    layoutDetectado: temLayoutV2 ? 'v2' : (temLayoutCxx ? 'v1-cxx' : 'desconhecido')
  };
}
// ─────────────────────────────────────────────────────────────────────────────
// Consulta de lote
// ─────────────────────────────────────────────────────────────────────────────

async function consultarLoteSefaz(numeroControle, ambiente = 'homologacao') {

  const ep = ENDPOINTS[ambiente];
  const pfx = carregarCertificado();

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
 xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">

  <soapenv:Header>

    <gnreCabecMsg
     xmlns="http://www.gnre.pe.gov.br/webservice/GnreResultadoLote">

      <versaoDados>2.00</versaoDados>

    </gnreCabecMsg>

  </soapenv:Header>

  <soapenv:Body>

    <gnreDadosMsg
     xmlns="http://www.gnre.pe.gov.br/webservice/GnreResultadoLote">

      <TConsLote_GNRE xmlns="http://www.gnre.pe.gov.br">

        <ambiente>2</ambiente>

        <numeroControle>${numeroControle}</numeroControle>

      </TConsLote_GNRE>

    </gnreDadosMsg>

  </soapenv:Body>

</soapenv:Envelope>`;

  const agent = new https.Agent({
    pfx,
    passphrase: SENHA_CERT,
    rejectUnauthorized: false
  });

  const response = await axios.post(
    ep.consulta,
    xml,
    {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"consultar"',
      }
    }
  );

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



      const envelopeXml = montarSoapEnvelope(dadosGuias);

      console.log('[GNRE] Envelope XML:\n', envelopeXml);

      // 5. Envia para SEFAZ
      const respostaSefaz = await enviarSoap(envelopeXml, AMBIENTE);
      console.log('[GNRE] Resposta SEFAZ:\n', respostaSefaz);

      const xmlResposta = typeof respostaSefaz === 'string'
        ? respostaSefaz
        : String(respostaSefaz?.body || '');

      const pastaXmlGnre = path.resolve(process.cwd(), 'xml-gnre');
      fs.mkdirSync(pastaXmlGnre, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const nomeArquivo = `retorno-gnre-${String(idVenda || 'sem-id')}-${timestamp}.xml`;
      const caminhoArquivoXml = path.join(pastaXmlGnre, nomeArquivo);

      fs.writeFileSync(caminhoArquivoXml, xmlResposta, 'utf8');
      console.log('[GNRE] XML salvo em:', caminhoArquivoXml);

      // 6. Parseia e retorna
      const resultado = parseResposta(xmlResposta);

      return res.status(resultado.sucesso ? 200 : 422).json({
        success: resultado.sucesso,
        numeroLote: resultado.numeroLote,
        dataRecibo: resultado.dataRecibo,
        situacao: resultado.situacao,
        guias: resultado.guias,
        calculo: dadosGuias.map(g => ({
          tipo: g.codigoReceita === CODIGOS_RECEITA.DIFAL ? 'DIFAL' : 'FCP',
          codigoReceita: g.codigoReceita,
          ufFavorecida: g.ufFavorecida,
          valorPrincipal: g.valorPrincipal,
        })),
        // Remova os campos abaixo em produção
        _debug: {
          xmlEnviado: envelopeXml,
          xmlResposta,
          arquivoXmlSalvo: caminhoArquivoXml,
        },
      });

    } catch (error) {
      console.error('[GNRE] Erro:', error?.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: error?.response?.data || error.message,
        stack: error.stack,
      });
    }
  }


  async consultarLote(req, res) {
    try {
      const { numeroLote } = req.query;
      if (!numeroLote) return res.status(400).json({ success: false, message: 'numeroLote obrigatório' });

      const respostaSefaz = await consultarLoteSefaz(numeroLote, AMBIENTE);
      const resultado = parseResposta(respostaSefaz);

      return res.status(200).json({
        success: resultado.sucesso,
        situacao: resultado.situacao,
        guias: resultado.guias,
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

      const dadosGuias = mapearVendaParaGuias(venda);
      const guiasXml = dadosGuias.map(montarGuiaXml);
      const envelopeXml = montarSoapEnvelope(guiasXml, AMBIENTE);

      // Retorna também o resumo do cálculo em JSON (conveniente para debug)
      if (req.query.formato === 'json') {
        return res.status(200).json({
          success: true,
          calculo: dadosGuias.map(g => ({
            tipo: g.codigoReceita === CODIGOS_RECEITA.DIFAL ? 'DIFAL' : 'FCP',
            codigoReceita: g.codigoReceita,
            ufFavorecida: g.ufFavorecida,
            valorPrincipal: g.valorPrincipal,
            dataVencimento: g.dataVencimento,
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

  async gerarGnreFixa(req, res) {
    try {
      const vendaFixa = {
        chave: '53260536769602005700550000000147921506192504',
        nnf: 14792,
        docEntry: 15405083,
        indFinal: 1,
        emitente: {
          CNPJ: '36.769.602/0057-00',
          xNome: 'GTO COMERCIO ATACADISTA...',
          state: 'DF',
          xLgr: 'SN',
          xMun: 'BRASILIA',
          CEP: '71.720-510',
          fone: null
        },
        destinatario: {
          CNPJ: '05.761.069/0001-51',
          xMun: 'SAO LUIS',
          UF: 'MA',
          indIEDest: '9',
          xNome: 'SOCIEDADE MARANHENSE DE DIREITOS HUMANOS'
        },
        valorNota: '179.980000'
      };

      const dadosGuias = mapearVendaParaGuias(vendaFixa);
      if (!dadosGuias.length) {
        return res.status(422).json({
          success: false,
          message: 'Nenhuma guia gerada para o payload fixo'
        });
      }

      const guiasXml = dadosGuias.map(montarGuiaXml);
      const envelopeXml = montarSoapEnvelope(guiasXml, AMBIENTE);

      const apenasPreview = String(req.query.preview || '1') === '1';
      if (apenasPreview) {
        return res.status(200).json({
          success: true,
          modo: 'preview',
          calculo: dadosGuias.map(g => ({
            codigoReceita: g.codigoReceita,
            valorPrincipal: g.valorPrincipal,
            ufFavorecida: g.ufFavorecida
          })),
          xmlEnvelope: envelopeXml
        });
      }

      const tentativas = [
        {
          nome: 'v2_header1_soap12_axis_cdata_ns_loterecepcao_action_processar',
          soapVersion: '1.2',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionProcessar,
          soapActionHeader: 'processar',
          envelope: {
            versaoDados: '1.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap12-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: ENDPOINTS?.[AMBIENTE]?.nsRecepcao,
            namespaceServico: ENDPOINTS?.[AMBIENTE]?.nsRecepcao
          }
        },
        {
          nome: 'v2_header2_soap12_axis_cdata_ns_loterecepcao_action_processar',
          soapVersion: '1.2',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionProcessar,
          soapActionHeader: 'processar',
          envelope: {
            versaoDados: '2.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap12-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: ENDPOINTS?.[AMBIENTE]?.nsRecepcao,
            namespaceServico: ENDPOINTS?.[AMBIENTE]?.nsRecepcao
          }
        },
        {
          nome: 'v2_header1_soap11_axis_cdata_ns_loterecepcao_action_processar',
          soapVersion: '1.1',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionProcessar,
          soapActionHeader: `"${ENDPOINTS?.[AMBIENTE]?.actionProcessar || ''}"`,
          envelope: {
            versaoDados: '1.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap11-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: ENDPOINTS?.[AMBIENTE]?.nsRecepcao,
            namespaceServico: ENDPOINTS?.[AMBIENTE]?.nsRecepcao
          }
        },
        {
          nome: 'v2_header2_soap11_axis_cdata_ns_loterecepcao_action_processar',
          soapVersion: '1.1',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionProcessar,
          soapActionHeader: `"${ENDPOINTS?.[AMBIENTE]?.actionProcessar || ''}"`,
          envelope: {
            versaoDados: '2.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap11-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: ENDPOINTS?.[AMBIENTE]?.nsRecepcao,
            namespaceServico: ENDPOINTS?.[AMBIENTE]?.nsRecepcao
          }
        },
        {
          nome: 'v2_header1_soap12_axis_cdata_action_processar',
          soapVersion: '1.2',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionProcessar,
          soapActionHeader: 'processar',
          envelope: {
            versaoDados: '1.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap12-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: 'http://www.gnre.pe.gov.br/wsdl/processar'
          }
        },
        {
          nome: 'v2_header1_soap12_axis_cdata_action_recepcao',
          soapVersion: '1.2',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionRecepcao,
          soapActionHeader: 'processar',
          envelope: {
            versaoDados: '1.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap12-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: 'http://www.gnre.pe.gov.br/wsdl/processar'
          }
        },
        {
          nome: 'v2_header2_soap12_axis_cdata_action_processar',
          soapVersion: '1.2',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionProcessar,
          soapActionHeader: 'processar',
          envelope: {
            versaoDados: '2.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap12-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: 'http://www.gnre.pe.gov.br/wsdl/processar'
          }
        },
        {
          nome: 'v2_header2_soap12_axis_cdata_action_recepcao',
          soapVersion: '1.2',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionRecepcao,
          soapActionHeader: 'processar',
          envelope: {
            versaoDados: '2.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap12-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: 'http://www.gnre.pe.gov.br/wsdl/processar'
          }
        },
        {
          nome: 'v2_header1_soap11_axis_cdata_action_processar',
          soapVersion: '1.1',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionProcessar,
          soapActionHeader: `"${ENDPOINTS?.[AMBIENTE]?.actionProcessar || ''}"`,
          envelope: {
            versaoDados: '1.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap11-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: 'http://www.gnre.pe.gov.br/wsdl/processar'
          }
        },
        {
          nome: 'v2_header2_soap11_axis_cdata_action_processar',
          soapVersion: '1.1',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionProcessar,
          soapActionHeader: `"${ENDPOINTS?.[AMBIENTE]?.actionProcessar || ''}"`,
          envelope: {
            versaoDados: '2.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap11-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: 'http://www.gnre.pe.gov.br/wsdl/processar'
          }
        },
        {
          nome: 'v2_header2_soap12_axis_cdata_ns_recepcaolote_action_processar',
          soapVersion: '1.2',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionProcessar,
          soapActionHeader: 'processar',
          envelope: {
            versaoDados: '2.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap12-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: ENDPOINTS?.[AMBIENTE]?.actionRecepcao,
            namespaceServico: ENDPOINTS?.[AMBIENTE]?.actionRecepcao
          }
        },
        {
          nome: 'v2_header2_soap12_axis_cdata_ns_recepcaolote_action_recepcao',
          soapVersion: '1.2',
          contentTypeAction: ENDPOINTS?.[AMBIENTE]?.actionRecepcao,
          soapActionHeader: ENDPOINTS?.[AMBIENTE]?.actionRecepcao,
          envelope: {
            versaoDados: '2.00',
            versaoLayout: '2.00',
            formatoSoap: 'soap12-axis-cdata',
            incluirVersaoLote: true,
            namespaceCabecalho: ENDPOINTS?.[AMBIENTE]?.actionRecepcao,
            namespaceServico: ENDPOINTS?.[AMBIENTE]?.actionRecepcao
          }
        },
        {
          nome: 'v1_soap11_axis_cdata',
          soapVersion: '1.1',
          envelope: { versaoDados: '1.00', versaoLayout: '1.00', formatoSoap: 'soap11-axis-cdata', incluirVersaoLote: false }
        },
        {
          nome: 'v1_soap12_axis_cdata',
          soapVersion: '1.2',
          envelope: { versaoDados: '1.00', versaoLayout: '1.00', formatoSoap: 'soap12-axis-cdata', incluirVersaoLote: false }
        },
      ];

      let respostaSefaz = null;
      let resultado = null;
      let envelopeEnviado = null;
      const historicoTentativas = [];

      for (const tentativa of tentativas) {
        envelopeEnviado = montarSoapEnvelope(guiasXml, AMBIENTE, {
          ...tentativa.envelope,
          guiasDados: dadosGuias
        });
        respostaSefaz = await enviarSoap(envelopeEnviado, AMBIENTE, {
          soapVersion: tentativa.soapVersion,
          contentTypeAction: tentativa.contentTypeAction,
          soapActionHeader: tentativa.soapActionHeader
        });
        resultado = parseResposta(respostaSefaz);

        const codigo = String(resultado?.situacao?.codigo || '');
        historicoTentativas.push({
          tentativa: tentativa.nome,
          codigo: codigo || null,
          descricao: resultado?.situacao?.descricao || resultado?.erro || null,
          sucesso: Boolean(resultado?.sucesso),
          diagnosticoEnvelope: diagnosticarEnvelope(envelopeEnviado)
        });

        if (resultado?.sucesso) break;
      }

      return res.status(resultado.sucesso ? 200 : 422).json({
        success: resultado.sucesso,
        situacao: resultado.situacao,
        numeroLote: resultado.numeroLote,
        dataRecibo: resultado.dataRecibo,
        guias: resultado.guias,
        documentos: (resultado.guias || []).map((g, idx) => ({
          item: idx + 1,
          numeroDocumento: g.numeroDocumento || null,
          linhaDigitavel: g.linhaDigitavel || null,
          codigoBarras: g.codigoBarras || null
        })),
        xmlResposta: respostaSefaz,
        _debug: {
          envelopeEnviado,
          tentativas: historicoTentativas
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default GnreController;

// Exporta utilitários para testes unitários
export { mapearVendaParaGuias, calcularDIFAL, montarGuiaXml, montarSoapEnvelope, parseResposta, CODIGOS_RECEITA, ALIQUOTAS_UF };


