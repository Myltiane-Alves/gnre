import fs from 'fs';
import path from 'path';
import https from 'https';
import axios from 'axios';
import xml2js from 'xml2js';
import { PDFGNRE } from './geradorGnre.js';

export async function getCertOptions(senha, fallbackPfxPath = './GTO COMERCIO 2026-2027.pfx') {

    if (process.env.CERT_PFX_BASE64) {
        try {
            const buf = Buffer.from(process.env.CERT_PFX_BASE64, "base64");
            if (buf.length > 0) {
                return { pfx: buf, senha };
            }
        } catch (e) {
            console.error("ERRO: CERT_PFX_BASE64 inválido:", e.message);
        }
    }

    if (fallbackPfxPath && fs.existsSync(fallbackPfxPath)) {
        try {
            const buf = fs.readFileSync(path.resolve(fallbackPfxPath));
            if (buf.length > 0) {
                return { pfx: buf, senha };
            }
        } catch (e) {
            console.error("ERRO ao ler arquivo PFX local:", e.message);
        }
    }

    if (process.env.CERT_PEM_CERT_BASE64 && process.env.CERT_PEM_KEY_BASE64) {
        try {
            const cert = Buffer.from(process.env.CERT_PEM_CERT_BASE64, "base64");
            const key = Buffer.from(process.env.CERT_PEM_KEY_BASE64, "base64");
            return { cert, key };
        } catch (e) {
            console.error("ERRO: CERT_PEM_*_BASE64 inválido:", e.message);
        }
    }

    return null;
}

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

// Norte, NE, CO e ES — recebem alíquota interestadual de 7% (Res. Senado 22/89)
const UF_ALIQUOTA_7 = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'GO', 'MA', 'MT', 'MS',
  'PA', 'PB', 'PI', 'PE', 'RN', 'RO', 'RR', 'SE', 'TO',
]);

const CODIGOS_RECEITA = {
  DIFAL:   '100102',  // ICMS Consumidor Final Não Contribuinte – EC 87/2015
  FCP:     '100120',  // Fundo de Combate à Pobreza
  ICMS_ST: '100099',  // ICMS Substituição Tributária
};

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
export default class GNRE {

    constructor() {
        /** HOMOLOGAÇÃO */
        this.URL_ENVIO = 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao';
        this.URL_CONSULTA = 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreResultadoLote';

        /** CERTIFICADO */
        this.certificado = fs.readFileSync('./GTO COMERCIO 2026-2027.pfx');
        this.senhaCertificado = '#GTO@2026#';

        /** HTTPS AGENT */
        this.httpsAgent = new https.Agent({
            pfx: this.certificado,
            passphrase: this.senhaCertificado,
            rejectUnauthorized: false
        });
    }

    removerMascara(valor = '') {
        return String(valor).replace(/\D/g, '');
    }

    normalizarMunicipioGNRE(codigoIBGE = '') {

        const apenas5 = String(codigoIBGE).replace(/\D/g, '').slice(0, 5);

        if (apenas5.length !== 5) {
            console.warn(`[GNRE] Código de município inválido: '${codigoIBGE}' → '${apenas5}'`);
        }

        return apenas5;
    }

    salvarRetornoXmlSefaz(tipo, xml, id = '') {
        if (!xml || typeof xml !== 'string') {
            return null;
        }

        try {
            const pastaXml = path.resolve(process.cwd(), 'xml-gnre');
            if (!fs.existsSync(pastaXml)) {
                fs.mkdirSync(pastaXml, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sufixo = id ? `_${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
            const nomeArquivo = `${tipo}${sufixo}_${timestamp}.xml`;
            const caminhoArquivo = path.join(pastaXml, nomeArquivo);

            fs.writeFileSync(caminhoArquivo, xml, 'utf8');
            return caminhoArquivo;
        } catch (e) {
            console.error('Erro ao salvar XML da SEFAZ:', e.message);
            return null;
        }
    }

    async gerarConsultaConfigUf({
        uf,
        receita,
        ambiente = 2,
        homologacao = true
    }) {

        const url = homologacao
            ? 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreConsultaConfigUf'
            : 'https://www.gnre.pe.gov.br/gnreWS/services/GnreConsultaConfigUf';

        const xml = `<?xml version="1.0" encoding="utf-8"?>
            <soapenv:Envelope
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">

                <soapenv:Header>
                    <gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreConsultaConfigUf">
                        <versaoDados>2.00</versaoDados>
                    </gnreCabecMsg>
                </soapenv:Header>

                <soapenv:Body>
                    <gnreDadosMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreConsultaConfigUf">
                        <TConsultaConfigUf xmlns="http://www.gnre.pe.gov.br">
                            <ambiente>${ambiente}</ambiente>
                            <uf>${uf}</uf>
                            <receita>${receita}</receita>
                        </TConsultaConfigUf>
                    </gnreDadosMsg>
                </soapenv:Body>

            </soapenv:Envelope>`;

        try {

            console.log('==== URL ====');
            console.log(url);

            console.log('==== XML ENVIADO ====');
            console.log(xml);

            const response = await axios.post(
                url,
                xml,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': 'consultar'
                    },
                    httpsAgent: this.httpsAgent,
                    timeout: 30000
                }
            );

            console.log('==== XML RETORNO ====');
            console.log(response.data);

            const json = await xml2js.parseStringPromise(
                response.data,
                {
                    explicitArray: false,
                    ignoreAttrs: false
                }
            );

            return {
                success: true,
                xmlEnviado: xml,
                xmlRetorno: response.data,
                json
            };

        } catch (error) {

            const xmlErro = error?.response?.data || error.message;

            console.log('==== ERRO GNRE ====');
            console.log(xmlErro);

            return {
                success: false,
                statusCode: error?.response?.status || null,
                xmlEnviado: xml,
                erro: xmlErro
            };
        }
    }

    async buscarCodigoMunicipioGNRE(codigoIBGE, uf, ufFavorecida = null) {
        try {
            const ibgeNormalizado = String(codigoIBGE).replace(/\D/g, '');
            const xmlConsulta = `<?xml version="1.0" encoding="utf-8"?>
                <soapenv:Envelope
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
                    <soapenv:Header>
                        <gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreConsultaConfigUf">
                            <versaoDados>2.00</versaoDados>
                        </gnreCabecMsg>
                    </soapenv:Header>
                    <soapenv:Body>
                        <gnreDadosMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreConsultaConfigUf">
                            <TConsultaConfigUf xmlns="http://www.gnre.pe.gov.br">
                                <ambiente>2</ambiente>
                                <uf>${ufFavorecida || uf}</uf>
                                <receita>${this.receita || '100102'}</receita>
                            </TConsultaConfigUf>
                        </gnreDadosMsg>
                    </soapenv:Body>
                </soapenv:Envelope>
            `;

            const URL_CONFIG_UF = 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreConsultaConfigUf';

            const response = await axios.post(
                URL_CONFIG_UF,
                xmlConsulta,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        SOAPAction: 'consultar'
                    },
                    httpsAgent: this.httpsAgent,
                    timeout: 30000
                }
            );

            const jsonResposta = await xml2js.parseStringPromise(response.data, { explicitArray: false });

            // Navega até a lista de municípios retornada
            const configUf = jsonResposta?.['soapenv:Envelope']
                ?.['soapenv:Body']
                ?.gnreRespostaMsg
                ?.['ns1:TRetConsultaConfigUf'];

            const municipios = configUf?.['ns1:municipios']?.['ns1:municipio'];

            if (!municipios) {
                console.warn(`[GNRE] Nenhum município retornado para UF ${uf}`);
                return ibgeNormalizado; // fallback: devolve o próprio IBGE
            }

            // municipios pode ser array ou objeto único
            const lista = Array.isArray(municipios) ? municipios : [municipios];

            // Tenta casar pelo código IBGE (campo ns1:codigoIbge ou similar)
            const encontrado = lista.find(m => {
                const ibgeRetornado = String(m?.['ns1:codigoIbge'] || '').replace(/\D/g, '');
                // IBGE completo (7 dígitos) ou truncado (5 dígitos) — testa os dois
                return (
                    ibgeRetornado === ibgeNormalizado ||
                    ibgeRetornado === ibgeNormalizado.slice(0, 5) ||
                    ibgeNormalizado === ibgeRetornado.slice(0, 5)
                );
            });

            if (encontrado) {
                const codigoGNRE = encontrado?.['ns1:codigo'] || encontrado?.['ns1:codigoMunicipio'];
                console.log(`[GNRE] Município IBGE ${ibgeNormalizado} → código GNRE ${codigoGNRE}`);
                return String(codigoGNRE);
            }

            console.warn(`[GNRE] Município IBGE ${ibgeNormalizado} não encontrado na tabela da UF ${uf}. Usando fallback.`);
            return ibgeNormalizado;

        } catch (error) {
            console.error('[GNRE] Erro ao buscar código município:', error.message);
            return String(codigoIBGE).replace(/\D/g, ''); // fallback seguro
        }
    }

    async gerarPdfGnre(payload, numeroControle = '') {
        try {
            const pastaSaida = path.resolve(process.cwd(), 'xml-gnre');
            if (!fs.existsSync(pastaSaida)) {
                fs.mkdirSync(pastaSaida, { recursive: true });
            }

            const nfe = {
                chave: payload?.chave || '',
                ide: {
                    nNF: String(payload?.nnf || ''),
                },
                emit: {
                    CNPJ: this.removerMascara(payload?.emitente?.CNPJ || ''),
                    xNome: payload?.emitente?.xNome || '',
                    UF: payload?.emitente?.state || '',
                    enderEmit: {
                        xLgr: payload?.emitente?.xLgr || '',
                        xMun: payload?.emitente?.xMun || payload?.emitente?.municipioEmitente || '',
                        UF: payload?.emitente?.state || '',
                        CEP: this.removerMascara(payload?.emitente?.CEP || ''),
                        fone: this.removerMascara(payload?.emitente?.fone || ''),
                    }
                },
                dest: {
                    UF: payload?.destinatario?.UF || '',
                    CPF: '',
                    CNPJ: this.removerMascara(payload?.destinatario?.CNPJ || ''),
                    enderDest: {
                        xMun: payload?.destinatario?.xMun || payload?.destinatario?.municipioDestinatario || '',
                    }
                }
            };

            const valorGNRE = Number(payload?.valorNota || 0);
            const calculo = {
                valorGNRE,
                receita: payload?.receita || '',
                valorDifal: valorGNRE,
                valorFCP: 0,
            };

            const agora = new Date();
            const referencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

            const estrutura = {
                TLote_GNRE: {
                    guias: {
                        TDadosGNRE: {
                            ufFavorecida: payload?.emitente?.state || '',
                            receita: payload?.receita || '',
                            docOrigem: String(payload?.nnf || payload?.chave || '').replace(/\D/g, ''),
                            referencia,
                            dataVencimento: payload?.dataVencimento || payload?.dataPagamento || new Date().toISOString().slice(0, 10),
                            valorPrincipal: valorGNRE,
                            valorTotal: valorGNRE,
                            convenio: '',
                            produto: '',
                            municipioDestinatario: payload?.emitente?.municipioEmitente || '',
                            numeroControle: numeroControle || '',
                        }
                    }
                }
            };

            const pdfBuffer = await PDFGNRE.gerarBuffer({ nfe, calculo, estrutura });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const nomeArquivo = `gnre_${String(payload?.nnf || 'sem_nnf')}_${timestamp}.pdf`;
            const caminhoPdf = path.join(pastaSaida, nomeArquivo);
            PDFGNRE.salvar(pdfBuffer, caminhoPdf);

            return {
                success: true,
                nomeArquivo,
                caminhoPdf,
            };
        } catch (e) {
            return {
                success: false,
                message: e.message,
            };
        }
    }

    async gerarXML(payload) {
        const emitCnpj = this.removerMascara(payload.emitente.CNPJ);
        const documentoOrigem = String(payload?.nnf || '').replace(/\D/g, '');
        const ufFavorecida = payload?.destinatario?.UF || '';
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const municipioEmitente = String(payload.emitente.municipioEmitente || '').padStart(5, '0');

        // ── Cálculo DIFAL ──────────────────────────────────────────────────────
        const ufOrigem = (payload.emitente.state || payload.emitente.UF || '').toUpperCase();
        const ufDestino = ufFavorecida.toUpperCase();
        const isConsumidorFinal =
            payload.indFinal === 1 || String(payload.indFinal) === '1' ||
            String(payload.destinatario?.indIEDest) === '9';

        let valorGnre = Number(payload.valorNota || 0);
        let receita = payload.receita || CODIGOS_RECEITA.DIFAL;

        if (isConsumidorFinal && ufOrigem && ufDestino && ufOrigem !== ufDestino) {
            const { difal, aliqInterestadual, aliqInterna } = calcularDIFAL(valorGnre, ufOrigem, ufDestino);
            console.log(
                `[GNRE] DIFAL: base=R$${valorGnre.toFixed(2)} | ` +
                `aliqInterest=${(aliqInterestadual * 100).toFixed(1)}% | ` +
                `aliqInterna=${(aliqInterna * 100).toFixed(1)}% | ` +
                `difal=R$${difal.toFixed(2)} | ${ufOrigem}→${ufDestino}`
            );
            valorGnre = difal;
            receita = payload.receita || CODIGOS_RECEITA.DIFAL;
        }

        const valor = valorGnre.toFixed(2);
        // ──────────────────────────────────────────────────────────────────────

        return `
            <TLote_GNRE versao="2.00" xmlns="http://www.gnre.pe.gov.br">
                <guias>
                    <TDadosGNRE versao="2.00">
                        <ufFavorecida>${ufFavorecida}</ufFavorecida>
                        <tipoGnre>0</tipoGnre>
                        <contribuinteEmitente>

                            <identificacao>
                                <CNPJ>${emitCnpj}</CNPJ>
                            </identificacao>
                            <razaoSocial>${payload.emitente.xNome}</razaoSocial>
                            <endereco>${payload.emitente.xLgr}</endereco>
                            <municipio>${municipioEmitente}</municipio>
                            <uf>${payload.emitente.state}</uf>
                            <cep>${this.removerMascara(payload.emitente.CEP)}</cep>
                            <telefone>${this.removerMascara(payload.emitente.fone || '')}</telefone>

                        </contribuinteEmitente>

                        <itensGNRE>

                            <item>
                                <receita>${receita}</receita>
                                <documentoOrigem tipo="${payload.tipoDocumento || 10}">${documentoOrigem}</documentoOrigem>
                                <referencia>
                                    <periodo>0</periodo>
                                    <mes>${mes}</mes>
                                    <ano>${ano}</ano>
                                </referencia>
                                <dataVencimento>${payload.dataVencimento}</dataVencimento>
                                <valor tipo="11">${valor}</valor>
                                <valor tipo="21">${valor}</valor>

                                <contribuinteDestinatario>
                                    <identificacao>
                                        <CNPJ>${this.removerMascara(payload.destinatario.CNPJ)}</CNPJ>
                                    </identificacao>
                                    <razaoSocial>${payload.destinatario.xNomeDestinatario}</razaoSocial>
                                    <municipio>${payload.destinatario.municipioDestinatario}</municipio>
                                </contribuinteDestinatario>
                                <camposExtras>
                                    <campoExtra>
                                        <codigo>113</codigo>
                                        <valor>${payload.chave}</valor>
                                    </campoExtra>

                                    <campoExtra>
                                        <codigo>112</codigo>
                                        <valor>33</valor>
                                    </campoExtra>
                                </camposExtras>
                            </item>

                        </itensGNRE>
                        <valorGNRE>${valor}</valorGNRE>
                        <dataPagamento>${payload.dataPagamento}</dataPagamento>
                    </TDadosGNRE>
                </guias>
            </TLote_GNRE>
        `.trim();
    }

    async montarSOAP(xmlGNRE) {

        return `<?xml version="1.0" encoding="utf-8"?>
            <soapenv:Envelope
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">

                    <soapenv:Header>
                        <gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao">
                            <versaoDados>2.00</versaoDados>
                        </gnreCabecMsg>
                    </soapenv:Header>

                    <soapenv:Body>
                        <gnreDadosMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao">
                            ${xmlGNRE}
                        </gnreDadosMsg>
                    </soapenv:Body>
            </soapenv:Envelope>`;
    }

    async enviarParaSefaz(payload) {

        try {
            const xmlGNRE = await this.gerarXML(payload);
            const soapXML = await this.montarSOAP(xmlGNRE);
            const response = await axios.post(
                this.URL_ENVIO,
                soapXML,
                {
                    headers: {'Content-Type': 'text/xml; charset=utf-8',SOAPAction: 'processar'},
                    httpsAgent: this.httpsAgent,
                    timeout: 60000
                }
            );

            const xmlResposta = response.data;
            const caminhoXmlResposta = this.salvarRetornoXmlSefaz('retorno_envio_gnre', xmlResposta, payload?.chave);
            const jsonResposta = await xml2js.parseStringPromise(xmlResposta, { explicitArray: false });
            const retorno = jsonResposta?.['soapenv:Envelope']?.['soapenv:Body']?.processarResponse?.['ns1:TRetLote_GNRE'];
            const situacao = retorno?.['ns1:situacaoRecepcao'];
            const codigo = situacao?.['ns1:codigo'];
            const recibo = retorno?.['ns1:recibo'];

            return {
                success: String(codigo || '') === '100',
                ambiente: retorno?.['ns1:ambiente'],
                codigo,
                descricao: situacao?.['ns1:descricao'],
                recibo,
                xmlEnviado: xmlGNRE,
                soapEnviado: soapXML,
                xmlResposta,
                caminhoXmlResposta,
                jsonResposta
            };

        } catch (error) {
            const xmlErro = error?.response?.data;
            console.log(xmlErro);
            const caminhoXmlErro = this.salvarRetornoXmlSefaz('retorno_erro_envio_gnre', xmlErro, payload?.chave);
            let jsonErro = null;

            if (xmlErro) {
                try {
                    jsonErro = await xml2js.parseStringPromise(xmlErro, { explicitArray: false });
                } catch (e) {
                    jsonErro = xmlErro;
                }
            }

            return {
                success: false,
                statusCode: error?.response?.status,
                message: error.message,
                xmlErro,
                caminhoXmlErro,
                jsonErro
            };

        }

    }

    async consultarLote(numeroRecibo) {

        try {

            numeroRecibo = String(numeroRecibo).trim();

            const xmlConsulta = `<?xml version="1.0" encoding="utf-8"?>
                <soapenv:Envelope
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">

                    <soapenv:Header>
                        <gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreResultadoLote"><versaoDados>2.00</versaoDados></gnreCabecMsg>
                    </soapenv:Header>

                    <soapenv:Body>
                        <gnreDadosMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreResultadoLote">
                            <TConsLote_GNRE xmlns="http://www.gnre.pe.gov.br">
                                <ambiente>2</ambiente>
                                <numeroRecibo>${numeroRecibo}</numeroRecibo>
                            </TConsLote_GNRE>
                        </gnreDadosMsg>
                    </soapenv:Body>
                </soapenv:Envelope>`;

            const response = await axios.post(
                this.URL_CONSULTA,
                xmlConsulta,
                {
                    headers: {'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'consultar'},
                    httpsAgent: this.httpsAgent,
                    timeout: 60000
                }
            );

            const xmlResposta = response.data;
            const jsonResposta = await xml2js.parseStringPromise(xmlResposta, { explicitArray: false});
            const retornoLote = jsonResposta?.['soapenv:Envelope']?.['soapenv:Body']?.gnreRespostaMsg?.['ns1:TResultLote_GNRE'];
            const situacaoProcess = retornoLote?.['ns1:situacaoProcess'];
            const codigo = situacaoProcess?.['ns1:codigo'];
            const descricao = situacaoProcess?.['ns1:descricao'];

            return {
                success: String(codigo || '') === '402',
                codigo,
                descricao,
                xmlConsulta,
                xmlResposta,
                jsonResposta
            };
        } catch (error) {
            return {
                success: false,
                erro: error?.response?.data || error.message
            };
        }
    }
}