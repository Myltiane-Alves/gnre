import axios from 'axios';
import GnrePhpMirrorClient, { ENDPOINTS, doRequest, headersLote, montarLoteGnreXml } from './gnrePhpMirror.js';

const API_URL = process.env.API_URL;
const CODIGOS_RECEITA = { DIFAL: '100102', FCP: '100120' };
const UF_IBGE = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35',
  PR: '41', SC: '42', RS: '43',
  MS: '50', MT: '51', GO: '52', DF: '53',
};

const MUNICIPIO_IBGE_FALLBACK = {
  BRASILIA: '5300108',
  'SAO LUIS': '2111300',
};

function toArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function somenteNumeros(v) {
  return v ? String(v).replace(/\D/g, '') : '';
}

function fmt2(v) {
  return Number(v || 0).toFixed(2);
}

function removerAcentos(v = '') {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function codigoIbgeMunicipio(valor, nomeFallback = '') {
  const numerico = somenteNumeros(valor || '');
  if (numerico.length >= 6) return numerico;

  const nome = removerAcentos(nomeFallback).toUpperCase().trim();
  return MUNICIPIO_IBGE_FALLBACK[nome] || '';
}

function codigoMunicipioV2(valor) {
  const numerico = somenteNumeros(valor || '');
  if (numerico.length >= 5) return numerico.slice(0, 5);
  return numerico;
}

function vencimentoPadrao() {
  const hoje = new Date();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const dow = fim.getDay();
  if (dow === 0) fim.setDate(fim.getDate() - 2);
  if (dow === 6) fim.setDate(fim.getDate() - 1);
  return fim.toISOString().slice(0, 10);
}

function calcularDifalFcp(valorBase, ufOrigem, ufDestino) {
  const mapa = {
    AC: { i: 0.19, fcp: 0.00 }, AL: { i: 0.20, fcp: 0.00 }, AP: { i: 0.18, fcp: 0.00 },
    AM: { i: 0.20, fcp: 0.00 }, BA: { i: 0.205, fcp: 0.02 }, CE: { i: 0.20, fcp: 0.00 },
    DF: { i: 0.20, fcp: 0.00 }, ES: { i: 0.17, fcp: 0.00 }, GO: { i: 0.19, fcp: 0.00 },
    MA: { i: 0.23, fcp: 0.02 }, MT: { i: 0.17, fcp: 0.00 }, MS: { i: 0.17, fcp: 0.00 },
    MG: { i: 0.18, fcp: 0.00 }, PA: { i: 0.19, fcp: 0.00 }, PB: { i: 0.20, fcp: 0.00 },
    PR: { i: 0.195, fcp: 0.00 }, PE: { i: 0.205, fcp: 0.00 }, PI: { i: 0.225, fcp: 0.00 },
    RJ: { i: 0.20, fcp: 0.02 }, RN: { i: 0.20, fcp: 0.00 }, RS: { i: 0.17, fcp: 0.00 },
    RO: { i: 0.195, fcp: 0.00 }, RR: { i: 0.20, fcp: 0.00 }, SC: { i: 0.17, fcp: 0.00 },
    SP: { i: 0.18, fcp: 0.00 }, SE: { i: 0.19, fcp: 0.00 }, TO: { i: 0.20, fcp: 0.00 },
  };

  const uf7 = new Set([
    'AC','AL','AP','AM','BA','CE','DF','GO','MA','MT','MS','PA','PB','PI','PE','RN','RO','RR','SE','TO',
  ]);

  const cfg = mapa[String(ufDestino || '').toUpperCase()];
  if (!cfg) throw new Error(`UF destino desconhecida: ${ufDestino}`);

  const aliqInterestadual = uf7.has(String(ufOrigem || '').toUpperCase()) ? 0.07 : 0.12;
  const base = Number(valorBase || 0);
  const difal = Number((base * (cfg.i - aliqInterestadual)).toFixed(2));
  const fcp = Number((base * cfg.fcp).toFixed(2));
  return { difal, fcp };
}

function mapearVendaParaGuias(venda = {}) {
  const emit = venda.emitente || {};
  const dest = venda.destinatario || {};
  const ufOrigem = String(emit.state || emit.UF || '').toUpperCase();
  const ufDestino = String(dest.UF || '').toUpperCase();
  const isConsumidorFinal = Number(venda.indFinal || 0) === 1 || String(dest.indIEDest || '') === '9';

  if (!isConsumidorFinal) return [];

  const { difal, fcp } = calcularDifalFcp(venda.valorNota, ufOrigem, ufDestino);

  const referenciaMes = String(new Date().getMonth() + 1).padStart(2, '0');
  const referenciaAno = String(new Date().getFullYear());
  const ufFavorecidaSigla = ufDestino;
  const municipioEmitenteIbge = codigoIbgeMunicipio(emit.cMun || emit.municipioIBGE, emit.xMun || '');
  const municipioDestinatarioIbge = codigoIbgeMunicipio(dest.cMun || dest.municipioIBGE, dest.xMun || '');
  const municipioEmitenteV2 = codigoMunicipioV2(municipioEmitenteIbge);
  const municipioDestinatarioV2 = codigoMunicipioV2(municipioDestinatarioIbge);

  const base = {
    c01_UfFavorecida: ufFavorecidaSigla,
    ufFavorecidaV2: ufDestino,
    c27_tipoIdentificacaoEmitente: '1',
    c03_idContribuinteEmitente: somenteNumeros(emit.CNPJ),
    c28_tipoDocOrigem: '10',
    c04_docOrigem: somenteNumeros(venda.chave || ''),
    c05_referencia: { mes: referenciaMes, ano: referenciaAno },
    c14_dataVencimento: vencimentoPadrao(),
    c16_razaoSocialEmitente: emit.xNome || '',
    c18_enderecoEmitente: emit.xLgr || '',
    c19_municipioEmitente: municipioEmitenteIbge,
    municipioEmitenteV2,
    c20_ufEnderecoEmitente: ufOrigem,
    c21_cepEmitente: somenteNumeros(emit.CEP || ''),
    c22_telefoneEmitente: somenteNumeros(emit.fone || ''),
    c34_tipoIdentificacaoDestinatario: '1',
    c35_idContribuinteDestinatario: somenteNumeros(dest.CNPJ),
    c37_razaoSocialDestinatario: dest.xNome || '',
    c38_municipioDestinatario: municipioDestinatarioIbge,
    municipioDestinatarioV2,
    c33_dataPagamento: new Date().toISOString().slice(0, 10),
  };

  const guias = [];
  if (difal > 0) {
    guias.push({
      ...base,
      c02_receita: CODIGOS_RECEITA.DIFAL,
      c06_valorPrincipal: fmt2(difal),
      c10_valorTotal: fmt2(difal),
    });
  }

  if (fcp > 0) {
    guias.push({
      ...base,
      c02_receita: CODIGOS_RECEITA.FCP,
      c06_valorPrincipal: fmt2(fcp),
      c10_valorTotal: fmt2(fcp),
    });
  }

  return guias;
}

function ambienteIdentificadorFromNome(ambiente = 'homologacao') {
  return String(ambiente).toLowerCase() === 'producao' ? 1 : 2;
}

function normalizarAmbiente(ambiente = 'homologacao') {
  return String(ambiente).toLowerCase() === 'producao' ? 'producao' : 'homologacao';
}

function namespaceRecepcaoPorAmbiente(ambiente = 'homologacao') {
  return normalizarAmbiente(ambiente) === 'producao'
    ? 'http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao'
    : 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao';
}

function montarEnvelopeAxis(guias = [], versaoCabecalho = '1.00', versaoLote = '1.00', opcoesNs = {}) {
  const nsRecepcao = opcoesNs.nsRecepcao || namespaceRecepcaoPorAmbiente('homologacao');
  const usarBodyServiceNs = opcoesNs.usarBodyServiceNs !== false;
  const usarCdata = opcoesNs.usarCdata !== false;
  const headerNamespace = opcoesNs.headerNamespace || 'http://www.gnre.pe.gov.br/wsdl/processar';

  const lote = montarLoteGnreXml(guias, versaoLote);
  const cabecalhoTag = '<gnreCabecMsg xmlns="' + headerNamespace + '"><versaoDados>'
    + versaoCabecalho
    + '</versaoDados></gnreCabecMsg>';

  const bodyAbertura = usarBodyServiceNs
    ? '<gnre:processar><gnre:gnreDadosMsg>' + (usarCdata ? '<![CDATA[' : '')
    : '<processar xmlns="http://www.gnre.pe.gov.br/wsdl/processar"><gnreDadosMsg>' + (usarCdata ? '<![CDATA[' : '');

  const bodyFechamento = usarBodyServiceNs
    ? (usarCdata ? ']]>' : '') + '</gnre:gnreDadosMsg></gnre:processar>'
    : (usarCdata ? ']]>' : '') + '</gnreDadosMsg></processar>';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:gnre="${nsRecepcao}">
  <soap12:Header>
    ${cabecalhoTag}
  </soap12:Header>
  <soap12:Body>
    ${bodyAbertura}${lote}${bodyFechamento}
  </soap12:Body>
</soap12:Envelope>`;
}

function contemFaultSimpleDeserializer(xml = '') {
  const texto = String(xml || '');
  return /SimpleDeserializer/i.test(texto) || /Server\.userException/i.test(texto);
}

function extrairCodigoRecepcao(xml = '') {
  const texto = String(xml || '');
  const match = texto.match(/<[^>]*codigo[^>]*>\s*(\d+)\s*<\/[^>]*codigo>/i);
  return match?.[1] || '';
}

function pontuarResposta(statusCode, codigo) {
  if (codigo && !['303', '104'].includes(codigo)) return 4;
  if (codigo === '303') return 3;
  if (codigo === '104') return 1;
  if (Number(statusCode || 0) >= 500) return 0;
  return 2;
}

class GnrePhpMirrorController {
  constructor() {
    this.preview = this.preview.bind(this);
    this.enviarLote = this.enviarLote.bind(this);
    this.consultarLote = this.consultarLote.bind(this);
  }

  criarClient(payload = {}) {
    const ambiente = payload.ambiente || process.env.GNRE_AMBIENTE || 'homologacao';

    return new GnrePhpMirrorClient({
      ambiente,
      senhaCert: payload.senhaCert || process.env.SENHA || '',
      certPfxBase64: payload.certPfxBase64 || process.env.CERT_PFX_BASE64 || '',
      certPfxPath: payload.certPfxPath || process.env.CERT_PFX_PATH || '',
      rejectUnauthorized: Boolean(payload.rejectUnauthorized ?? false),
    });
  }

  async resolverGuias(req = {}) {
    const payload = req.body || {};
    const guiasDiretas = toArray(payload.guias);
    if (guiasDiretas.length > 0) {
      return guiasDiretas;
    }

    const idVenda = String(payload.idVenda || req.query?.idVenda || '').trim();
    if (!idVenda) {
      throw new Error('Informe body.guias ou idVenda');
    }

    if (!API_URL) {
      throw new Error('API_URL nao configurada');
    }

    const { data } = await axios.get(`${API_URL}/api/venda/venda-gnre.xsjs?docEntry=${idVenda}`);
    const venda = data?.data?.[0]?.venda;
    if (!venda) {
      throw new Error('Venda nao encontrada para idVenda informado');
    }

    const guias = mapearVendaParaGuias(venda);
    if (guias.length === 0) {
      throw new Error('Nao foi possivel montar guias com os dados da venda');
    }

    return guias;
  }

  async preview(req, res) {
    try {
      const payload = req.body || {};
      const guias = await this.resolverGuias(req);

      const client = this.criarClient(payload);
      const versaoDados = payload.versaoDados || '1.00';
      const xmlEnvelope = client.gerarXmlLote(guias, { versaoDados });

      res.set('Content-Type', 'application/xml');
      return res.status(200).send(xmlEnvelope);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async enviarLote(req, res) {
    try {
      const payload = req.body || {};
      const guias = await this.resolverGuias(req);

      const client = this.criarClient(payload);
      const ambiente = normalizarAmbiente(payload.ambiente || process.env.GNRE_AMBIENTE || 'homologacao');
      const versaoDadosInicial = payload.versaoDados || '2.00';
      const timeoutMs = Number(payload.timeoutMs || 30000);
      const debug = Boolean(payload.debugXml ?? true);
      const permitirMixVersao = Boolean(payload.permitirMixVersao ?? false);
      const permitirFallbackVersao = Boolean(payload.permitirFallbackVersao ?? false);

      const ep = ENDPOINTS[ambiente];
      const headersPadrao = headersLote(ambiente);
      const actionsHeaderBase = [ep.loteHeaderAction, ep.loteMsgNamespace].filter(Boolean);
      const actionsHeaderPayload = toArray(payload.loteHeaderActions).map(String).filter(Boolean);
      const actionsHeader = Array.from(new Set([...actionsHeaderPayload, ...actionsHeaderBase]));

      const montarHeadersPorAction = (action) => ({
        ...headersPadrao,
        'Content-Type': `application/soap+xml;charset=utf-8;action="${action}"`,
      });
      const debugTentativas = [];
      const variacoesNs = [
        { id: 'hdrWsdl_bodyService_plain', headerNamespace: 'http://www.gnre.pe.gov.br/wsdl/processar', usarBodyServiceNs: true, usarCdata: false },
        { id: 'hdrService_bodyService_plain', headerNamespace: ep.loteMsgNamespace, usarBodyServiceNs: true, usarCdata: false },
        { id: 'hdrWsdl_bodyWsdl_plain', headerNamespace: 'http://www.gnre.pe.gov.br/wsdl/processar', usarBodyServiceNs: false, usarCdata: false },
        { id: 'hdrService_bodyWsdl_plain', headerNamespace: ep.loteMsgNamespace, usarBodyServiceNs: false, usarCdata: false },
        { id: 'hdrWsdl_bodyService_cdata', headerNamespace: 'http://www.gnre.pe.gov.br/wsdl/processar', usarBodyServiceNs: true, usarCdata: true },
        { id: 'hdrService_bodyService_cdata', headerNamespace: ep.loteMsgNamespace, usarBodyServiceNs: true, usarCdata: true },
        { id: 'hdrWsdl_bodyWsdl_cdata', headerNamespace: 'http://www.gnre.pe.gov.br/wsdl/processar', usarBodyServiceNs: false, usarCdata: true },
        { id: 'hdrService_bodyWsdl_cdata', headerNamespace: ep.loteMsgNamespace, usarBodyServiceNs: false, usarCdata: true },
      ];
      const tentativasPadrao = versaoDadosInicial === '2.00'
        ? [
            { cab: '2.00', lote: '2.00' },
            ...(permitirFallbackVersao ? [{ cab: '1.00', lote: '1.00' }] : []),
          ]
        : [
            { cab: '1.00', lote: '1.00' },
            ...(permitirFallbackVersao ? [{ cab: '2.00', lote: '2.00' }] : []),
          ];



      const tentativasVersao = [
   { cab: '2.00', lote: '2.00' },
   { cab: '1.00', lote: '1.00' }
];

      let respostaFinal = null;
      let modoEnvioFinal = null;
      let melhorScore = -1;
      let melhorResposta = null;
      let melhorModoEnvio = null;
      let interromperLoop = false;

      for (const tentativa of tentativasVersao) {
        const xmlEspelhoPhp = client.gerarXmlLote(guias, {
          versaoCabecalho: tentativa.cab,
          versaoLote: tentativa.lote,
        });

        for (const actionHeader of actionsHeader) {
          let resposta = await doRequest({
            url: ep.loteUrl,
            xml: xmlEspelhoPhp,
            headers: montarHeadersPorAction(actionHeader),
            pfx: client.pfx,
            passphrase: client.senhaCert,
            rejectUnauthorized: client.rejectUnauthorized,
            timeoutMs,
          });
          let modoEnvio = `php-mirror-action:${actionHeader}`;

          debugTentativas.push({
            modo: `php-mirror-action:${actionHeader}-cab${tentativa.cab}-lote${tentativa.lote}`,
            xmlEnviado: xmlEspelhoPhp,
            statusCode: resposta.statusCode,
            codigoRecepcao: extrairCodigoRecepcao(resposta.body),
          });

          if (Number(resposta.statusCode || 0) >= 500 && contemFaultSimpleDeserializer(resposta.body)) {
            for (const nsOpt of variacoesNs) {
              const xmlAxisCdata = montarEnvelopeAxis(guias, tentativa.cab, tentativa.lote, {
                ...nsOpt,
                nsRecepcao: ep.loteMsgNamespace,
              });

              resposta = await doRequest({
                url: ep.loteUrl,
                xml: xmlAxisCdata,
                headers: montarHeadersPorAction(actionHeader),
                pfx: client.pfx,
                passphrase: client.senhaCert,
                rejectUnauthorized: client.rejectUnauthorized,
                timeoutMs,
              });

              modoEnvio = `axis-cdata-fallback-action:${actionHeader}`;
              debugTentativas.push({
                modo: `axis-cdata-${nsOpt.id}-action:${actionHeader}-cab${tentativa.cab}-lote${tentativa.lote}`,
                xmlEnviado: xmlAxisCdata,
                statusCode: resposta.statusCode,
                codigoRecepcao: extrairCodigoRecepcao(resposta.body),
              });

              const codigoAxis = extrairCodigoRecepcao(resposta.body);
              if (!['303', '104'].includes(codigoAxis) || Number(resposta.statusCode || 0) >= 500) {
                break;
              }
            }
          }

          respostaFinal = resposta;
          modoEnvioFinal = `${modoEnvio}-cab${tentativa.cab}-lote${tentativa.lote}`;

          const codigo = extrairCodigoRecepcao(resposta.body);
          const score = pontuarResposta(resposta.statusCode, codigo);
          if (score > melhorScore) {
            melhorScore = score;
            melhorResposta = resposta;
            melhorModoEnvio = modoEnvioFinal;
          }

          if (!['303', '104'].includes(codigo)) {
            interromperLoop = true;
            break;
          }
        }

        if (interromperLoop) {
          break;
        }
      }

      if (melhorResposta) {
        respostaFinal = melhorResposta;
        modoEnvioFinal = melhorModoEnvio;
      }

      return res.status(200).json({
        success: true,
        ambiente,
        modoEnvio: modoEnvioFinal,
        statusCode: respostaFinal?.statusCode,
        headers: respostaFinal?.headers,
        xmlResposta: respostaFinal?.body,
        _debug: debug ? { tentativas: debugTentativas } : undefined,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async consultarLote(req, res) {
    try {
      const payload = req.body || {};
      const numeroRecibo = String(payload.numeroRecibo || payload.recibo || '').trim();
      if (!numeroRecibo) {
        return res.status(400).json({
          success: false,
          message: 'numeroRecibo e obrigatorio',
        });
      }

      const ambiente = payload.ambiente || process.env.GNRE_AMBIENTE || 'homologacao';
      const ambienteIdentificador = Number(
        payload.ambienteIdentificador || ambienteIdentificadorFromNome(ambiente)
      );

      const client = this.criarClient(payload);
      const versaoDados = payload.versaoDados || '1.00';
      const timeoutMs = Number(payload.timeoutMs || 30000);

      const resposta = await client.consultarLote({
        numeroRecibo,
        ambienteIdentificador,
        versaoDados,
        timeoutMs,
      });

      return res.status(200).json({
        success: true,
        ambiente,
        statusCode: resposta.statusCode,
        headers: resposta.headers,
        xmlResposta: resposta.body,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new GnrePhpMirrorController();
