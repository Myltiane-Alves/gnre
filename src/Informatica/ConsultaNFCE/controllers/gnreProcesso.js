import path from 'path';
import axios from 'axios';
import fs from 'fs';
import https from 'https';
import 'dotenv/config';
import { GeradorGNRE, PDFGNRE, ValidacaoGNRE } from './geradorGnre.js';
import { create } from 'xmlbuilder2';
import { calcularDIFAL, CODIGOS_RECEITA } from './index.js';

const url = process.env.API_URL;
const SENHA_CERT = process.env.SENHA || '#senhagto2024#';

function normalizarAmbiente(valor = '') {
  const ambiente = String(valor || '').trim().toLowerCase();
  return ambiente === 'producao' ? 'producao' : 'homologacao';
}

function somenteDigitos(valor = '') {
  return String(valor || '').replace(/\D/g, '');
}

function formatarValorMonetario(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    return null;
  }

  return numero.toFixed(2);
}

function extrairTagXml(xml = '', nomesTag = []) {
  for (const nome of nomesTag) {
    const regex = new RegExp(
      `<(?:\\w+:)?${nome}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${nome}>`,
      'i'
    );
    const match = String(xml || '').match(regex);
    if (match?.[1]) {
      return String(match[1]).trim();
    }
  }
  return null;
}

function extrairControleOficialSefaz(xml = '') {
  // LOG: XML recebido para extração
  console.log('==== [extrairControleOficialSefaz] XML RECEBIDO ====', xml);
  const numeroControleBruto = extrairTagXml(xml, [
    'numeroControle',
    'c41_numeroControle',
    'c41_numcontrole'
  ]);

  const linhaDigitavelBruta = extrairTagXml(xml, [
    'linhaDigitavel',
    'representacaoNumerica',
    'codigoBarras'
  ]);

  const numeroControle = String(numeroControleBruto || '').replace(/\D/g, '') || null;
  const linhaDigitavel = String(linhaDigitavelBruta || '').replace(/\D/g, '') || null;

  // LOG: Dados extraídos
  console.log('==== [extrairControleOficialSefaz] DADOS EXTRAÍDOS ====', { numeroControle, linhaDigitavel });

  return {
    numeroControle,
    linhaDigitavel
  };
}

function extrairErroSefaz(xml = '') {
  const faultCode = extrairTagXml(xml, ['faultcode', 'Value']);
  const faultReason = extrairTagXml(xml, ['faultstring', 'Text', 'Reason']);
  const detalhes = extrairTagXml(xml, ['detail', 'Detail']);
  const contemFault = /<\s*[^>]*fault[\s>]/i.test(String(xml || ''));

  if (!contemFault && !faultCode && !faultReason) {
    return null;
  }

  return {
    faultCode: faultCode || null,
    faultReason: faultReason || null,
    detalhes: detalhes || null
  };
}

function controleOficialValido(controleOficial = {}) {
  const numeroControle = String(controleOficial?.numeroControle || '').replace(/\D/g, '');
  const linhaDigitavel = String(controleOficial?.linhaDigitavel || '').replace(/\D/g, '');

  return {
    numeroControle,
    linhaDigitavel,
    valido: numeroControle.length === 16 && linhaDigitavel.length >= 44
  };
}

function extrairSituacaoRecepcao(xml = '') {
  const bloco = extrairTagXml(xml, ['situacaoRecepcao']);
  const codigo = String(extrairTagXml(bloco || '', ['codigo']) || '').replace(/\D/g, '');
  const descricao = extrairTagXml(bloco || '', ['descricao']);

  if (!codigo && !descricao) {
    return null;
  }

  return {
    codigo: codigo || null,
    descricao: descricao || null
  };
}

function extrairNumeroRecibo(xml = '') {
  const bloco = extrairTagXml(xml, ['recibo']);
  const numero = String(extrairTagXml(bloco || '', ['numero']) || '').replace(/\D/g, '');
  return numero || null;
}

function extrairVersoesEnvelope(xmlEnvelope = '') {
  const xml = String(xmlEnvelope || '');
  const versaoCabecalho = String(extrairTagXml(xml, ['versaoDados']) || '').trim() || null;

  const cdataMatch = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
  const xmlDados = cdataMatch?.[1] ? cdataMatch[1] : xml;

  const matchLote = xmlDados.match(/<\s*(?:\w+:)?TLote_GNRE\b[^>]*\bversao\s*=\s*["']([^"']+)["']/i);
  const matchDados = xmlDados.match(/<\s*(?:\w+:)?TDadosGNRE\b[^>]*\bversao\s*=\s*["']([^"']+)["']/i);

  return {
    versaoCabecalho,
    versaoLote: matchLote?.[1] ? String(matchLote[1]).trim() : null,
    versaoDados: matchDados?.[1] ? String(matchDados[1]).trim() : null,
  };
}

function normalizarNomeVariante(valor = '') {
  return String(valor || '')
    .trim()
    .replace(/wdl/gi, 'wsdl')
    .replace(/soap12_soap12/gi, 'soap12');
}

function extrairSituacaoProcessamento(xml = '') {
  const bloco = extrairTagXml(xml, ['situacaoProcess']);
  const codigo = String(extrairTagXml(bloco || '', ['codigo']) || '').replace(/\D/g, '');
  const descricao = extrairTagXml(bloco || '', ['descricao']);

  if (!codigo && !descricao) {
    return null;
  }

  return {
    codigo: codigo || null,
    descricao: descricao || null
  };
}

function extrairResultadoGuia(xml = '') {
  const guia = extrairTagXml(xml, ['guia']);
  if (!guia) {
    return null;
  }

  const situacaoGuia = String(extrairTagXml(guia, ['situacaoGuia']) || '').replace(/\D/g, '');
  const nossoNumero = String(extrairTagXml(guia, ['nossoNumero']) || '').replace(/\D/g, '') || null;
  const linhaDigitavel = String(extrairTagXml(guia, ['linhaDigitavel', 'representacaoNumerica']) || '').replace(/\D/g, '') || null;
  const codigoBarras = String(extrairTagXml(guia, ['codigoBarras']) || '').replace(/\D/g, '') || null;

  const motivoRegex = /<(?:\w+:)?motivo[^>]*>([\s\S]*?)<\/(?:\w+:)?motivo>/gi;
  const motivos = [];
  let match;
  while ((match = motivoRegex.exec(guia)) !== null) {
    const blocoMotivo = match[1];
    motivos.push({
      codigo: String(extrairTagXml(blocoMotivo, ['codigo']) || '').replace(/\D/g, '') || null,
      descricao: extrairTagXml(blocoMotivo, ['descricao']) || null,
      campo: extrairTagXml(blocoMotivo, ['campo']) || null
    });
  }

  return {
    situacaoGuia: situacaoGuia || null,
    nossoNumero,
    linhaDigitavel,
    codigoBarras,
    motivos
  };
}

const UF_IBGE = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35',
  PR: '41', SC: '42', RS: '43',
  MS: '50', MT: '51', GO: '52', DF: '53'
};

function ufSiglaParaCodigoIbge(uf = '') {
  return UF_IBGE[String(uf || '').toUpperCase()] || null;
}

const MUNICIPIO_V2_FIXO = {
  BRASILIA: '53001',
  'BRASILIA - DF': '53001',
  SAO_LUIS: '21113',
  'SAO_LUIS - MA': '21113',
};

function normalizarCodigoMunicipioV2(valor = '') {
  const bruto = String(valor || '').trim();
  if (!bruto) return null;

  const digitos = bruto.replace(/\D/g, '');
  if (digitos.length >= 5) {
    return digitos.slice(0, 5);
  }

  const chave = bruto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  return MUNICIPIO_V2_FIXO[chave] || null;
}

const PFX_CANDIDATOS = [
  process.env.CERT_PFX_PATH,
  './GTO COMERCIO 2026-2027.pfx',
  './certs/GTO COMERCIO 2026-2027.pfx',
  './src/certs/GTO COMERCIO 2026-2027.pfx'
].filter(Boolean);

function resolverPrimeiroPfxValido() {
  for (const candidato of PFX_CANDIDATOS) {
    const caminhoAbsoluto = path.resolve(candidato);
    if (fs.existsSync(caminhoAbsoluto)) {
      return caminhoAbsoluto;
    }
  }
  return null;
}

export async function getCertOptions(senha, fallbackPfxPath = './GTO COMERCIO 2026-2027.pfx') {
  // -----------------------------
  // 1) PFX BASE64 VIA ENV
  // -----------------------------
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

  // -----------------------------
  // 2) PFX ARQUIVO LOCAL
  // -----------------------------
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

  // -----------------------------
  // 3) PEM BASE64 (cert + key)
  // -----------------------------
  if (process.env.CERT_PEM_CERT_BASE64 && process.env.CERT_PEM_KEY_BASE64) {
    try {
      const cert = Buffer.from(process.env.CERT_PEM_CERT_BASE64, "base64");
      const key = Buffer.from(process.env.CERT_PEM_KEY_BASE64, "base64");
      return { cert, key };
    } catch (e) {
      console.error("ERRO: CERT_PEM_*_BASE64 inválido:", e.message);
    }
  }

  // -----------------------------
  // 4) PEM POR CAMINHO
  // -----------------------------
  // if (process.env.CERT_PEM_CERT_PATH && process.env.CERT_PEM_KEY_PATH) {
  //   try {
  //     const cert = fs.readFileSync(process.env.CERT_PEM_CERT_PATH);
  //     const key = fs.readFileSync(process.env.CERT_PEM_KEY_PATH);
  //     return { cert, key };
  //   } catch (e) {
  //     console.error("ERRO ao ler caminhos PEM:", e.message);
  //   }
  // }

  // -----------------------------
  // 5) NADA ENCONTRADO
  // -----------------------------
  return null;
}

const config = {
  sefazUrl: {
    homologacao:
      'https://www.testegnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao',
  },

  sefazAction: {
    homologacao: 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao/processar',
  },

  sefazResultadoUrl: {
    homologacao:
      'https://www.testegnre.pe.gov.br/gnreWS/services/GnreResultadoLote',
  },

  sefazResultadoAction: {
    homologacao: 'http://www.testegnre.pe.gov.br/webservice/GnreResultadoLote/consultar',
  },

  certificatePath: resolverPrimeiroPfxValido(),
  certificatePassword: SENHA_CERT,
};

class GnreProcessoController {
  constructor() {
    this.processar = this.processar.bind(this);
    this.gerarPdf = this.gerarPdf.bind(this);
    this.consultarGnre = this.consultarGnre.bind(this);
    this.gerarGnreSimples = this.gerarGnreSimples.bind(this);
  }

  extrairEntradaConsulta(req = {}) {
    const body = req?.body || {};
    const query = req?.query || {};

    const idVenda = String(body?.idVenda ?? query?.idVenda ?? '').trim();
    const ambiente = normalizarAmbiente(body?.ambiente ?? query?.ambiente);
    const variante = String(body?.variante ?? query?.variante ?? '').trim();
    const modoDiagnosticoEntrada = String(body?.modoDiagnostico ?? query?.modoDiagnostico ?? '').trim().toLowerCase();
    const modoDiagnostico = ['1', 'true', 'sim', 'yes', 'on'].includes(modoDiagnosticoEntrada);

    return { idVenda, ambiente, variante, modoDiagnostico };
  }

  // Função para obter opções de certificado PFX
  async getCertOptions(senha, fallbackPfxPath = './GTO COMERCIO 2026-2027.pfx') {
    try {
      // Tentar carregar do ambiente primeiro (Base64)
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

      // Tentar carregar do arquivo local
      const caminhoPfx = fallbackPfxPath ? path.resolve(fallbackPfxPath) : resolverPrimeiroPfxValido();

      if (caminhoPfx && fs.existsSync(caminhoPfx)) {
        try {
          const buf = fs.readFileSync(caminhoPfx);
          if (buf.length > 0) {
            return { pfx: buf, senha };
          }
        } catch (e) {
          console.error("ERRO ao ler arquivo PFX:", e.message);
          throw new Error(`Erro ao ler certificado PFX: ${e.message}`);
        }
      }

      throw new Error('Certificado PFX não encontrado');
    } catch (error) {
      console.error('Erro ao obter certificado:', error.message);
      return null;
    }
  }

  validarFluxo(fluxo = {}) {
    const {
      modeloOrigem = '65',
      houveDevolucao65 = false,
      modeloDestino = '55'
    } = fluxo;

    if (String(modeloOrigem) !== '65') {
      const error = new Error('Fluxo inválido: o processo GNRE esperado inicia em venda modelo 65.');
      error.statusCode = 400;
      throw error;
    }

    if (!houveDevolucao65) {
      const error = new Error('Fluxo inválido: é necessário confirmar a devolução da venda modelo 65.');
      error.statusCode = 400;
      throw error;
    }

    if (String(modeloDestino) !== '55') {
      const error = new Error('Fluxo inválido: a venda precisa ser recriada no modelo 55 antes da GNRE.');
      error.statusCode = 400;
      throw error;
    }
  }

  avaliarCenario(nfe) {
    ValidacaoGNRE.validarNFe(nfe);

    const precisaGNRE = ValidacaoGNRE.precisaGNRE(nfe);

    return {
      precisaGNRE,
      dados: {
        ufOrigem: nfe?.emit?.UF || null,
        ufDestino: nfe?.dest?.UF || null,
        interestadual: (nfe?.emit?.UF || '') !== (nfe?.dest?.UF || ''),
        consumidorFinal: nfe?.ide?.indFinal === '1',
        naoContribuinte: nfe?.dest?.indIEDest === '9'
      }
    };
  }

  async gerarResultado(reqBody = {}) {
    const {
      fluxo = {},
      nfe = null,
      opcoes = {}
    } = reqBody;

    this.validarFluxo(fluxo);

    const avaliacao = this.avaliarCenario(nfe);

    if (!avaliacao.precisaGNRE) {
      return {
        dispensada: true,
        avaliacao
      };
    }

    const gerador = new GeradorGNRE();
    const resultado = await gerador.gerar(nfe, {
      salvarArquivo: opcoes?.salvarArquivo ?? true,
      pastaSaida: opcoes?.pastaSaida ?? './gnre'
    });

    return {
      dispensada: false,
      avaliacao,
      resultado,
      nfe,
      opcoes
    };
  }

  async processar(req, res) {
    try {
      const { dispensada, avaliacao, resultado, nfe, opcoes } = await this.gerarResultado(req.body || {});

      if (dispensada) {
        return res.status(200).json({
          success: true,
          etapa: 'avaliacao_gnre',
          status: 'dispensada',
          message: 'Operação não exige GNRE para este cenário fiscal.',
          dados: avaliacao.dados
        });
      }

      let caminhoPdf = null;
      let arquivoPdf = null;
      const pastaSaida = opcoes?.pastaSaida ?? './gnre';
      const deveSalvarPdf = opcoes?.salvarPdf !== false;

      if (deveSalvarPdf) {
        const pdfBuffer = await PDFGNRE.gerarBuffer({
          nfe,
          calculo: resultado.calculo,
          estrutura: resultado.estrutura,
          controleOficial: opcoes?.controleOficial || null
        });

        arquivoPdf = `GNRE_${nfe?.ide?.nNF || 'sem_numero'}.pdf`;
        caminhoPdf = PDFGNRE.salvar(
          pdfBuffer,
          path.join(pastaSaida, arquivoPdf)
        );
      }

      return res.status(200).json({
        success: true,
        etapa: 'gnre_emitida',
        status: 'emitida',
        message: 'GNRE processada com sucesso.',
        gnre: {
          receita: resultado?.calculo?.receita || null,
          valorGNRE: resultado?.calculo?.valorGNRE || null,
          valorDifal: resultado?.calculo?.valorDifal || null,
          valorFCP: resultado?.calculo?.valorFCP || null,
          arquivo: resultado?.arquivo || null,
          caminhoArquivo: resultado?.caminhoArquivo || null,
          arquivoPdf,
          caminhoPdf,
          xml: resultado?.xml || null
        }
      });
    } catch (error) {
      return res.status(error?.statusCode || 500).json({
        success: false,
        etapa: 'erro_tecnico',
        message: error?.message || 'Falha ao processar GNRE.',
      });
    }
  }

  async gerarPdf(req, res) {
    try {
      const { dispensada, avaliacao, resultado, nfe, opcoes } = await this.gerarResultado(req.body || {});

      if (dispensada) {
        return res.status(200).json({
          success: true,
          etapa: 'avaliacao_gnre',
          status: 'dispensada',
          message: 'Operação não exige GNRE para este cenário fiscal.',
          dados: avaliacao.dados
        });
      }

      const pdfBuffer = await PDFGNRE.gerarBuffer({
        nfe,
        calculo: resultado.calculo,
        estrutura: resultado.estrutura,
        controleOficial: opcoes?.controleOficial || null
      });

      if (opcoes?.salvarPdf !== false) {
        const nomeArquivoPdf = `GNRE_${nfe?.ide?.nNF || 'sem_numero'}.pdf`;
        PDFGNRE.salvar(pdfBuffer, path.join(opcoes?.pastaSaida ?? './gnre', nomeArquivoPdf));
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="GNRE_${nfe?.ide?.nNF || 'sem_numero'}.pdf"`);
      return res.end(pdfBuffer);
    } catch (error) {
      return res.status(error?.statusCode || 500).json({
        success: false,
        etapa: 'erro_tecnico',
        message: error?.message || 'Falha ao gerar PDF da GNRE.',
      });
    }
  }

  async consultarGnre(req, res) {
    try {
      const { idVenda, ambiente, variante, modoDiagnostico } = this.extrairEntradaConsulta(req);

      let venda;

      if (req.body?.chave && req.body?.emitente) {
        venda = req.body;
      } else {
        if (!idVenda) {
          return res.status(400).json({ error: 'idVenda é obrigatório para gerar GNRE.' });
        }

        if (!url) {
          return res.status(500).json({ error: 'API_URL não configurada no ambiente.' });
        }

        const apiUrl = `${url}/api/venda/venda-gnre.xsjs?docEntry=${idVenda}`;

        const response = await axios.get(apiUrl);
        const vendaData = response.data;

        if (!vendaData || !vendaData.data || vendaData.data.length === 0) {
          return res.status(404).json({ error: 'Venda não encontrada.' });
        }
        venda = vendaData.data[0]?.venda;
      }
      const ufFavorecida = venda?.destinatario?.UF;

      // ── Cálculo DIFAL ────────────────────────────────────────────────────────
      const ufOrigem = (venda?.emitente?.state || venda?.emitente?.UF || '').toUpperCase();
      const ufDestinoCalc = (ufFavorecida || '').toUpperCase();
      const isConsumidorFinal =
        venda?.indFinal === 1 || String(venda?.indFinal) === '1' ||
        String(venda?.destinatario?.indIEDest) === '9';

      let valorBaseGnre = parseFloat(venda?.valorNota || 0);
      let receita = venda?.receita || CODIGOS_RECEITA.DIFAL;

      if (isConsumidorFinal && ufOrigem && ufDestinoCalc && ufOrigem !== ufDestinoCalc) {
        const { difal, fcp, aliqInterestadual, aliqInterna, aliqFCP } =
          calcularDIFAL(valorBaseGnre, ufOrigem, ufDestinoCalc);
        console.log(
          `[GNRE] DIFAL: base=R$${valorBaseGnre.toFixed(2)} | ` +
          `aliqInterest=${(aliqInterestadual * 100).toFixed(1)}% | ` +
          `aliqInterna=${(aliqInterna * 100).toFixed(1)}% | ` +
          `difal=R$${difal.toFixed(2)} | fcp=${(aliqFCP * 100).toFixed(1)}% R$${fcp.toFixed(2)} | ` +
          `${ufOrigem}→${ufDestinoCalc}`
        );
        valorBaseGnre = difal;
        receita = CODIGOS_RECEITA.DIFAL;
      }
      // ─────────────────────────────────────────────────────────────────────────

      const valorPrincipal = formatarValorMonetario(valorBaseGnre);
      const valorTotal = formatarValorMonetario(valorBaseGnre);
      const dataVencimento = venda?.dataVencimento || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const razaoSocialEmitente = venda?.emitente?.xNome;
      const razaoSocialDestinatario = venda?.destinatario?.xNomeDestinatario || venda?.destinatario?.xNome || ' ';

      const nfeNormalizada = {
        chave: venda?.chave,
        ide: {
          nNF: String(venda?.nnf || ''),
          indFinal: String(venda?.indFinal ?? '0')
        },
        emit: {
          CNPJ: somenteDigitos(venda?.emitente?.CNPJ),
          xNome: venda?.emitente?.xNome || '',
          UF: venda?.emitente?.state || venda?.emitente?.UF || '',
          enderEmit: {
            xLgr: venda?.emitente?.xLgr || '',
            xMun: venda?.emitente?.xMun || '',
            UF: venda?.emitente?.state || venda?.emitente?.UF || '',
            CEP: somenteDigitos(venda?.emitente?.CEP),
            fone: somenteDigitos(venda?.emitente?.fone),
          }
        },
        dest: {
          CNPJ: somenteDigitos(venda?.destinatario?.CNPJ),
          CPF: somenteDigitos(venda?.destinatario?.CPF),
          UF: venda?.destinatario?.UF || venda?.destinatario?.state || '',
          xNome: venda?.destinatario?.xNomeDestinatario || venda?.destinatario?.xNome || '',
          enderDest: {
            xLgr: venda?.destinatario?.xLgr || '',
            xMun: venda?.destinatario?.xMun || '',
            UF: venda?.destinatario?.state || venda?.destinatario?.UF || '',
            CEP: somenteDigitos(venda?.destinatario?.CEP),
            fone: somenteDigitos(venda?.destinatario?.fone),
          },
          indIEDest: String(venda?.destinatario?.indIEDest || '9')
        },
        total: {
          ICMSTot: {
            vNF: formatarValorMonetario(venda?.valorNota)  // valor original da NF-e (não DIFAL)
          }
        }
      };

      // console.log('Dados da venda:', venda);
      console.log('ufFavorecida:', ufFavorecida);
      console.log('valorPrincipal:', valorPrincipal);
      console.log('valorTotal:', valorTotal)
      console.log('dataVencimento:', dataVencimento);
      console.log('razaoSocialEmitente:', razaoSocialEmitente);
      console.log('razaoSocialDestinatario:', razaoSocialDestinatario);

      if (!ufFavorecida || !receita || !valorPrincipal || !valorTotal || !dataVencimento) {
        return res.status(400).json({ error: 'Dados incompletos para consulta GNRE.' });
      }

      if (!nfeNormalizada.emit?.CNPJ || !nfeNormalizada.dest?.UF || !nfeNormalizada.total?.ICMSTot?.vNF) {
        return res.status(400).json({ error: 'Dados da venda inválidos para gerar GNRE.' });
      }

      // Validar certificado
      const certOptions = await this.getCertOptions(SENHA_CERT, config.certificatePath || './GTO COMERCIO 2026-2027.pfx');
      if (!certOptions) {
        return res.status(500).json({
          error: 'Não foi possível carregar o certificado. Verifique as variáveis de ambiente ou o arquivo local.'
        });
      }

      // Gerar envelope SOAP
      const dadosGnre = {
        ufFavorecida,
        receita,
        valorPrincipal,
        valorTotal,
        dataVencimento,
        dataPagamento: venda?.dataPagamento || new Date().toISOString().split('T')[0],
        referenciaPeriodo: '0',
        referenciaMes: String(new Date().getMonth() + 1).padStart(2, '0'),
        referenciaAno: String(new Date().getFullYear()),
        razaoSocialEmitente,
        razaoSocialDestinatario,
        enderecoEmitente: nfeNormalizada?.emit?.enderEmit?.xLgr || '',
        municipioEmitente: normalizarCodigoMunicipioV2(nfeNormalizada?.emit?.enderEmit?.xMun || venda?.emitente?.municipioEmitente || ''),
        ufEmitente: nfeNormalizada?.emit?.UF || '',
        cepEmitente: somenteDigitos(nfeNormalizada?.emit?.enderEmit?.CEP || ''),
        municipioDestinatario: normalizarCodigoMunicipioV2(nfeNormalizada?.dest?.enderDest?.xMun || venda?.destinatario?.municipioDestinatario || ''),
        documentoEmitente: nfeNormalizada?.emit?.CNPJ || nfeNormalizada?.emit?.CPF || '',
        tipoDocEmitente: nfeNormalizada?.emit?.CNPJ ? '1' : '2',
        documentoDestinatario: nfeNormalizada?.dest?.CNPJ || nfeNormalizada?.dest?.CPF || '',
        tipoDocDestinatario: nfeNormalizada?.dest?.CNPJ ? '1' : '2',
        documentoOrigem: String(nfeNormalizada?.chave || nfeNormalizada?.ide?.nNF || '').replace(/\D/g, '').slice(0, 60)
      };
      const actionRecepcao = ambiente === 'producao'
        ? 'http://www.gnre.pe.gov.br/webservice/GnreRecepcaoLote'
        : 'http://www.testegnre.pe.gov.br/webservice/GnreRecepcaoLote';
      const actionProcessar = ambiente === 'producao'
        ? 'http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao/processar'
        : 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao/processar';
      const nsServicoRecepcao = ambiente === 'producao'
        ? 'http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao'
        : 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao';

      const variantesEnvio = [
        {
          nome: 'v2_oficial_direct_wsdl_action_recepcao',
          opcoesEnvelope: {
            versaoDados: '2.00',
            usarNamespaceCabecalhoWsdl: true,
            versaoLayout: '2.00',
            formatoSoap: 'soap12-direct',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionRecepcao,
            soapAction: 'processar'
          }
        },
        {
          nome: 'v2_direct_wsdl_action_processar',
          opcoesEnvelope: {
            versaoDados: '2.00',
            usarNamespaceCabecalhoWsdl: true,
            versaoLayout: '2.00',
            formatoSoap: 'soap12-direct',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionProcessar,
            soapAction: actionProcessar
          }
        },
        {
          nome: 'v2_direct_cdata_wsdl_action_recepcao',
          opcoesEnvelope: {
            versaoDados: '2.00',
            usarNamespaceCabecalhoWsdl: true,
            versaoLayout: '2.00',
            formatoSoap: 'soap12-direct-cdata',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionRecepcao,
            soapAction: 'processar'
          }
        },
        {
          nome: 'v2_direct_cdata_wsdl_action_processar',
          opcoesEnvelope: {
            versaoDados: '2.00',
            usarNamespaceCabecalhoWsdl: true,
            versaoLayout: '2.00',
            formatoSoap: 'soap12-direct-cdata',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionProcessar,
            soapAction: actionProcessar
          }
        },
        {
          nome: 'v2_direct_service_action_recepcao',
          opcoesEnvelope: {
            versaoDados: '2.00',
            usarNamespaceCabecalhoWsdl: false,
            versaoLayout: '2.00',
            formatoSoap: 'soap12-direct',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionRecepcao,
            soapAction: 'processar',
            namespaceServicoRecepcao: nsServicoRecepcao
          }
        },
        {
          nome: 'v2_header2_serviceNs',
          opcoesEnvelope: {
            versaoDados: '2.00',
            usarNamespaceCabecalhoWsdl: false,
            versaoLayout: '2.00',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionRecepcao,
            soapAction: 'processar'
          }
        },
        {
          nome: 'v2_header2_wsdlNs',
          opcoesEnvelope: {
            versaoDados: '2.00',
            usarNamespaceCabecalhoWsdl: true,
            versaoLayout: '2.00',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionRecepcao,
            soapAction: 'processar'
          }
        },
        {
          nome: 'v2_header2_wsdlNs_soap12_axis_cdata',
          opcoesEnvelope: {
            versaoDados: '2.00',
            usarNamespaceCabecalhoWsdl: true,
            versaoLayout: '2.00',
            formatoSoap: 'soap12-axis-cdata',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionRecepcao,
            soapAction: 'processar'
          }
        },
        {
          nome: 'v2_header2_wsdlNs_soap12_axis_cdata_action_processar',
          opcoesEnvelope: {
            versaoDados: '2.00',
            usarNamespaceCabecalhoWsdl: true,
            versaoLayout: '2.00',
            formatoSoap: 'soap12-axis-cdata',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionProcessar,
            soapAction: actionProcessar
          }
        },
        {
          nome: 'v2_header2_wsdlNs_axis_cdata_action_processar',
          opcoesEnvelope: {
            versaoDados: '2.00',
            usarNamespaceCabecalhoWsdl: true,
            versaoLayout: '2.00',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionProcessar,
            soapAction: `"${actionProcessar}"`
          }
        },
        {
          nome: 'v2_header1_wsdlNs',
          opcoesEnvelope: {
            versaoDados: '1.00',
            usarNamespaceCabecalhoWsdl: true,
            versaoLayout: '2.00',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionRecepcao,
            soapAction: 'processar'
          }
        },
        {
          nome: 'v2_header1_wsdlNs_soap12_axis_cdata',
          opcoesEnvelope: {
            versaoDados: '1.00',
            usarNamespaceCabecalhoWsdl: true,
            versaoLayout: '2.00',
            formatoSoap: 'soap12-axis-cdata',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionRecepcao,
            soapAction: 'processar'
          }
        },
        {
          nome: 'v2_header1_wsdlNs_axis_cdata_action_processar',
          opcoesEnvelope: {
            versaoDados: '1.00',
            usarNamespaceCabecalhoWsdl: true,
            versaoLayout: '2.00',
            loteNamespaceV2: 'http://www.gnre.pe.gov.br',
            contentTypeAction: actionProcessar,
            soapAction: `"${actionProcessar}"`
          }
        },
      ];

      let sefazResponse = null;
      let controleOficial = null;
      let erroSefaz = null;
      let situacaoRecepcao = null;
      let numeroRecibo = null;
      let varianteUsada = null;
      const tentativasDiagnostico = [];

      const buildDiagnosticoEnvio = (opcoesEnvelope = {}) => {
        const formatoSoap = String(opcoesEnvelope?.formatoSoap || 'axis-cdata');
        const usaSoap12 = formatoSoap.startsWith('soap12');
        const action = String(opcoesEnvelope?.contentTypeAction || config.sefazAction[ambiente] || '');
        const contentType = usaSoap12
          ? `application/soap+xml;charset=utf-8;action="${action}"`
          : 'text/xml; charset=utf-8';

        const soapAction = (typeof opcoesEnvelope?.soapAction === 'string' && opcoesEnvelope.soapAction.trim())
          ? opcoesEnvelope.soapAction.trim()
          : (usaSoap12 ? action : `"${action}"`);

        return {
          ambiente,
          action,
          soapAction,
          contentType,
          formatoSoap,
          versaoDados: String(opcoesEnvelope?.versaoDados || '2.00'),
          usarNamespaceCabecalhoWsdl: Boolean(opcoesEnvelope?.usarNamespaceCabecalhoWsdl),
          loteNamespaceV2: String(opcoesEnvelope?.loteNamespaceV2 || 'http://www.gnre.pe.gov.br'),
          endpoint: config.sefazUrl[ambiente]
        };
      };

      let variantesSelecionadas = variantesEnvio;
      if (modoDiagnostico) {
        if (variante) {
          const varianteNormalizada = normalizarNomeVariante(variante);
          variantesSelecionadas = variantesEnvio.filter((item) => item.nome === varianteNormalizada);
          if (variantesSelecionadas.length === 0) {
            return res.status(400).json({
              success: false,
              etapa: 'diagnostico_parametro_invalido',
              message: 'Variante informada nao existe para o envio GNRE.',
              diagnostico: {
                varianteSolicitada: variante,
                varianteNormalizada,
                variantesDisponiveis: variantesEnvio.map((item) => item.nome)
              }
            });
          }
        } else {
          variantesSelecionadas = [variantesEnvio[0]];
        }
      }

      for (let i = 0; i < variantesSelecionadas.length; i += 1) {
        const itemVariante = variantesSelecionadas[i];
        const xmlEnvelope = await this.gerarEnvelopeSOAP(dadosGnre, ambiente, itemVariante.opcoesEnvelope);
        varianteUsada = itemVariante.nome;
        const diagnosticoEnvio = buildDiagnosticoEnvio(itemVariante.opcoesEnvelope);
        const versoesXml = extrairVersoesEnvelope(xmlEnvelope);

        console.log(`==== XML ENVIADO PARA SEFAZ (${itemVariante.nome}) ====`);
        console.log(xmlEnvelope);
        console.log(`==== DIAGNOSTICO ENVIO (${itemVariante.nome}) ====`, diagnosticoEnvio);
        console.log(`==== DIAGNOSTICO VERSOES XML (${itemVariante.nome}) ====`, versoesXml);

        try {
          sefazResponse = await this.enviarParaSefaz(
            xmlEnvelope,
            ambiente,
            certOptions,
            itemVariante.opcoesEnvelope
          );
          console.log(`==== RESPOSTA SEFAZ (${itemVariante.nome}) status/headers ====`, sefazResponse?.statusCode, sefazResponse?.headers);
          console.log(`==== RESPOSTA SEFAZ (${itemVariante.nome}) body ====`, sefazResponse?.body);
        } catch (e) {
          return res.status(500).json({ error: 'Erro ao consultar SEFAZ: ' + (e.message || e) });
        }

        controleOficial = extrairControleOficialSefaz(sefazResponse?.body || '');
        erroSefaz = extrairErroSefaz(sefazResponse?.body || '');
        situacaoRecepcao = extrairSituacaoRecepcao(sefazResponse?.body || '');
        numeroRecibo = extrairNumeroRecibo(sefazResponse?.body || '');

        tentativasDiagnostico.push({
          variante: itemVariante.nome,
          statusCode: sefazResponse?.statusCode || null,
          codigoRecepcao: situacaoRecepcao?.codigo || null,
          descricaoRecepcao: situacaoRecepcao?.descricao || null,
          faultCode: erroSefaz?.faultCode || null,
          faultReason: erroSefaz?.faultReason || null,
          envio: diagnosticoEnvio,
          versoesXml
        });

        const houveErroTecnico = Number(sefazResponse?.statusCode || 0) >= 400 || Boolean(erroSefaz);
        const codigoRecepcao = String(situacaoRecepcao?.codigo || '');
        const exigeFallbackFuncional = ['104', '303'].includes(codigoRecepcao);

        if (!houveErroTecnico && !exigeFallbackFuncional) {
          break;
        }

        if (modoDiagnostico) {
          break;
        }

        if (i < variantesSelecionadas.length - 1) {
          const motivoFallback = houveErroTecnico
            ? `HTTP/SOAP fault (${sefazResponse?.statusCode || 'sem_status'})`
            : `codigo ${codigoRecepcao}`;

          console.warn(`==== FALLBACK ${motivoFallback}: tentando próxima variante (${variantesSelecionadas[i + 1].nome}) ====`);
          continue;
        }

        break;
      }

      let controleResolvido = controleOficial;
      let resultadoLote = null;

      if ((Number(sefazResponse?.statusCode || 0) >= 400) || erroSefaz) {
        console.error('==== ERRO SOAP SEFAZ IDENTIFICADO ====', {
          statusCode: sefazResponse?.statusCode,
          erroSefaz
        });

        return res.status(502).json({
          success: false,
          etapa: 'sefaz_rejeicao',
          message: 'A SEFAZ rejeitou a solicitação GNRE. A guia não foi registrada no portal.',
          sefaz: {
            statusCode: sefazResponse?.statusCode || null,
            faultCode: erroSefaz?.faultCode || null,
            faultReason: erroSefaz?.faultReason || null,
            detalhes: erroSefaz?.detalhes || null
          },
          diagnostico: {
            modoDiagnostico,
            varianteSolicitada: variante || null,
            varianteUsada,
            envio: sefazResponse?.request || null,
            tentativas: tentativasDiagnostico
          }
        });
      }

      if (situacaoRecepcao?.codigo && situacaoRecepcao.codigo !== '100') {
        console.error('==== REJEICAO FUNCIONAL SEFAZ ====', {
          statusCode: sefazResponse?.statusCode,
          situacaoRecepcao
        });

        return res.status(502).json({
          success: false,
          etapa: 'sefaz_rejeicao_funcional',
          message: 'A SEFAZ rejeitou a guia por regra de negócio. A guia não foi registrada no portal.',
          sefaz: {
            statusCode: sefazResponse?.statusCode || null,
            codigo: situacaoRecepcao?.codigo || null,
            descricao: situacaoRecepcao?.descricao || null
          },
          diagnostico: {
            modoDiagnostico,
            varianteSolicitada: variante || null,
            varianteUsada,
            envio: sefazResponse?.request || null,
            tentativas: tentativasDiagnostico
          }
        });
      }

      if (numeroRecibo) {
        resultadoLote = await this.consultarResultadoLote(numeroRecibo, ambiente, certOptions);
        console.log('==== RESULTADO DO LOTE POR RECIBO ====', resultadoLote);

        if ((Number(resultadoLote?.statusCode || 0) >= 400) || extrairErroSefaz(resultadoLote?.body || '')) {
          return res.status(502).json({
            success: false,
            etapa: 'sefaz_resultado_lote_erro',
            message: 'A SEFAZ aceitou o lote, mas a consulta do resultado falhou.',
            sefaz: {
              numeroRecibo,
              statusCode: resultadoLote?.statusCode || null,
              body: resultadoLote?.body || null
            }
          });
        }

        const situacaoProcess = extrairSituacaoProcessamento(resultadoLote?.body || '');
        const resultadoGuia = extrairResultadoGuia(resultadoLote?.body || '');

        if (situacaoProcess?.codigo && situacaoProcess.codigo !== '100') {
          return res.status(502).json({
            success: false,
            etapa: 'sefaz_resultado_lote_rejeicao',
            message: 'O lote foi recebido, mas o processamento da guia foi rejeitado pela SEFAZ.',
            sefaz: {
              numeroRecibo,
              codigo: situacaoProcess?.codigo || null,
              descricao: situacaoProcess?.descricao || null,
              guia: resultadoGuia
            }
          });
        }

        if (resultadoGuia?.situacaoGuia && resultadoGuia.situacaoGuia !== '0') {
          return res.status(502).json({
            success: false,
            etapa: 'sefaz_guia_invalidada',
            message: 'A SEFAZ processou o lote, mas a guia foi invalidada.',
            sefaz: {
              numeroRecibo,
              situacaoGuia: resultadoGuia?.situacaoGuia || null,
              motivos: resultadoGuia?.motivos || []
            }
          });
        }

        controleResolvido = {
          numeroControle: resultadoGuia?.nossoNumero || controleOficial?.numeroControle || null,
          linhaDigitavel: resultadoGuia?.linhaDigitavel || resultadoGuia?.codigoBarras || controleOficial?.linhaDigitavel || null
        };
      }

      const controleValidado = controleOficialValido(controleResolvido);

      if (!controleValidado.valido) {
        console.error('==== CONTROLE OFICIAL INVÁLIDO/INCOMPLETO ====', {
          statusCode: sefazResponse?.statusCode,
          controleOficial: controleResolvido,
          controleValidado
        });

        return res.status(502).json({
          success: false,
          etapa: 'sefaz_sem_controle',
          message: 'A SEFAZ não retornou número de controle/linha digitável válidos. A guia não foi registrada no portal.',
          sefaz: {
            statusCode: sefazResponse?.statusCode || null,
            numeroRecibo,
            numeroControle: controleValidado.numeroControle || null,
            linhaDigitavel: controleValidado.linhaDigitavel || null,
            resultadoLote: resultadoLote?.body || null
          }
        });
      }

      // LOG: Dados extraídos do XML da SEFAZ
      console.log('==== CONTROLE OFICIAL EXTRAÍDO ====', controleResolvido);

      // Montar objeto de request customizado para processar GNRE com dados da venda
      const reqProcessar = {
        body: {
          nfe: nfeNormalizada,
          idVenda,
          opcoes: {
            salvarArquivo: true,
            salvarPdf: true,
            pastaSaida: './gnre',
            controleOficial: controleResolvido
          },
          fluxo: {
            modeloOrigem: '65',
            houveDevolucao65: true,
            modeloDestino: '55'
          }
        }
      };

      // LOG: Objeto enviado para processar/gerar PDF
      console.log('==== OBJETO PARA PROCESSAR/PDF ====', JSON.stringify(reqProcessar, null, 2));

      // Chama processar passando os dados da venda
      console.log(reqProcessar, 'resposta da SEFAZ:',);
      await this.processar(reqProcessar, res);
    } catch (error) {
      console.error('Erro ao consultar GNRE:', error);
      return res.status(500).json({ error: error.message || 'Erro ao consultar GNRE.' });
    }
  }

  // Adicione esta função ao controller
  gerarXmlDadosGnreV2(dados, loteNamespaceV2 = 'http://www.gnre.pe.gov.br') {
  const uf         = String(dados.ufFavorecida || '').trim().toUpperCase();
  const receita    = String(dados.receita || '').replace(/\D/g,'').padStart(6,'0').slice(0,6);
  const docEmit    = String(dados.documentoEmitente   || '').replace(/\D/g,'');
  const docDest    = String(dados.documentoDestinatario || '').replace(/\D/g,'');
  const docOrigem  = String(dados.documentoOrigem || '').replace(/\D/g,'').slice(0,60) || '0';

  const identEmit  = dados.tipoDocEmitente === '2'
    ? `<CPF>${docEmit}</CPF>` : `<CNPJ>${docEmit}</CNPJ>`;
  const identDest  = dados.tipoDocDestinatario === '2'
    ? `<CPF>${docDest}</CPF>` : `<CNPJ>${docDest}</CNPJ>`;

  // Campos opcionais do emitente
  const tagEndereco  = dados.enderecoEmitente
    ? `\n        <endereco>${String(dados.enderecoEmitente).slice(0,60)}</endereco>` : '';
  const tagMunEmit   = dados.municipioEmitente
    ? `\n        <municipio>${dados.municipioEmitente}</municipio>` : '';
  const tagUfEmit    = dados.ufEmitente
    ? `\n        <uf>${String(dados.ufEmitente).toUpperCase().slice(0,2)}</uf>` : '';
  const tagCepEmit   = dados.cepEmitente
    ? `\n        <cep>${String(dados.cepEmitente).replace(/\D/g,'').slice(0,8)}</cep>` : '';
  const tagMunDest   = dados.municipioDestinatario
    ? `\n              <municipio>${dados.municipioDestinatario}</municipio>` : '';

  const mes  = String(dados.referenciaMes  || '').padStart(2,'0').slice(0,2);
  const ano  = String(dados.referenciaAno  || '').slice(0,4);
  const per  = String(dados.referenciaPeriodo || '0');
  const razEmit = String(dados.razaoSocialEmitente   || '').slice(0,60);
  const razDest = String(dados.razaoSocialDestinatario || '').slice(0,60);

  // ⚠️ namespace APENAS no TLote_GNRE, sem redeclarar nos filhos
  return `<TLote_GNRE versao="2.00" xmlns="${loteNamespaceV2}">
  <guias>
    <TDadosGNRE versao="2.00">
      <ufFavorecida>${uf}</ufFavorecida>
      <tipoGnre>0</tipoGnre>
      <contribuinteEmitente>
        <identificacao>${identEmit}</identificacao>
        <razaoSocial>${razEmit}</razaoSocial>${tagEndereco}${tagMunEmit}${tagUfEmit}${tagCepEmit}
      </contribuinteEmitente>
      <itensGNRE>
        <item>
          <receita>${receita}</receita>
          <documentoOrigem tipo="10">${docOrigem}</documentoOrigem>
          <referencia>
            <periodo>${per}</periodo>
            <mes>${mes}</mes>
            <ano>${ano}</ano>
          </referencia>
          <dataVencimento>${dados.dataVencimento}</dataVencimento>
          <valor tipo="11">${dados.valorPrincipal}</valor>
          <valor tipo="21">${dados.valorTotal}</valor>
          <contribuinteDestinatario>
            <identificacao>${identDest}</identificacao>
            <razaoSocial>${razDest}</razaoSocial>${tagMunDest}
          </contribuinteDestinatario>
        </item>
      </itensGNRE>
      <valorGNRE>${dados.valorTotal}</valorGNRE>
      <dataPagamento>${String(dados.dataPagamento || dados.dataVencimento || '')}</dataPagamento>
      <identificadorGuia>1</identificadorGuia>
    </TDadosGNRE>
  </guias>
</TLote_GNRE>`;
}

  async gerarGnreSimples(req, res) {
    return this.consultarGnre(req, res);
  }

  async enviarParaSefaz(xml, ambiente = 'homologacao', certOptions = null, opcoesEnvelope = {}) {
    const sefazUrl = config.sefazUrl[ambiente];
    console.log('URL SEFAZ:', sefazUrl);
    const sefazAction = String(opcoesEnvelope?.contentTypeAction || config.sefazAction[ambiente] || '');
    if (!sefazUrl) {
      throw new Error(`Ambiente inválido para URL SEFAZ: ${ambiente}`);
    }

    if (!sefazAction) {
      throw new Error(`Action SOAP inválida para ambiente: ${ambiente}`);
    }

    if (!certOptions?.pfx && !(certOptions?.cert && certOptions?.key)) {
      throw new Error('Certificado não carregado para envio à SEFAZ.');
    }

    const formatoSoap = String(opcoesEnvelope?.formatoSoap || 'axis-cdata');
    const usaSoap12 = formatoSoap.startsWith('soap12');

    const contentType = usaSoap12
      ? `application/soap+xml;charset=utf-8;action="${sefazAction}"`
      : 'text/xml; charset=utf-8';

    let soapActionHeader;
    if (typeof opcoesEnvelope?.soapAction === 'string' && opcoesEnvelope.soapAction.trim()) {
      soapActionHeader = opcoesEnvelope.soapAction.trim();
    } else {
      soapActionHeader = usaSoap12 ? sefazAction : `"${sefazAction}"`;
    }

    // LOG: XML enviado
    console.log('==== [enviarParaSefaz] XML ENVIADO ====');
    console.log(xml);

    const options = {
      hostname: new URL(sefazUrl).hostname,
      port: 443,
      path: new URL(sefazUrl).pathname,
      method: 'POST',

      headers: {
        'Content-Type': contentType,
        SOAPAction: soapActionHeader,
        'Content-Length': Buffer.byteLength(xml, 'utf8'),
      },
    };

    if (certOptions?.pfx) {
      options.pfx = certOptions.pfx;
      options.passphrase = certOptions.senha || config.certificatePassword;
    } else {
      options.cert = certOptions.cert;
      options.key = certOptions.key;
    }

    return await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {

          // SALVA XML COMPLETO RETORNADO PELA SEFAZ
          fs.writeFileSync('retorno-sefaz.xml', data);

          // LOG: Resposta recebida da SEFAZ
          console.log('==== [enviarParaSefaz] RESPOSTA SEFAZ ====', res.statusCode, res.headers);

          console.log('==== [enviarParaSefaz] BODY ====', data);

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            request: {
              ambiente,
              endpoint: sefazUrl,
              action: sefazAction,
              soapAction: soapActionHeader,
              contentType,
              formatoSoap,
              usarNamespaceCabecalhoWsdl: Boolean(opcoesEnvelope?.usarNamespaceCabecalhoWsdl),
              loteNamespaceV2: String(opcoesEnvelope?.loteNamespaceV2 || 'http://www.gnre.pe.gov.br'),
              namespaceServicoRecepcao: String(opcoesEnvelope?.namespaceServicoRecepcao || '') || null
            }
          });
        });
      });

      req.on('error', (error) => {
        // LOG: Erro ao enviar para SEFAZ

        fs.writeFileSync('xml-enviado.xml', xml);
        console.error('==== [enviarParaSefaz] ERRO AO ENVIAR PARA SEFAZ ====', error);
        reject(error);
      });

      req.write(xml);
      req.end();
    });
  }

  async consultarResultadoLote(numeroRecibo, ambiente = 'homologacao', certOptions = null) {
    const xmlConsulta = this.gerarEnvelopeConsultaResultado(numeroRecibo, ambiente);
    console.log('==== [consultarResultadoLote] XML ENVIADO ====', xmlConsulta);

    const sefazUrl = config.sefazResultadoUrl[ambiente];
    const sefazAction = config.sefazResultadoAction[ambiente];

    if (!sefazUrl || !sefazAction) {
      throw new Error(`Configuração de consulta de resultado ausente para ambiente: ${ambiente}`);
    }

    const options = {
      hostname: new URL(sefazUrl).hostname,
      port: 443,
      path: new URL(sefazUrl).pathname,
      method: 'POST',
      headers: {
        'Content-Type': `application/soap+xml;charset=utf-8;action="${sefazAction}"`,
        SOAPAction: sefazAction,
        'Content-Length': Buffer.byteLength(xmlConsulta),
      },
    };

    if (certOptions?.pfx) {
      options.pfx = certOptions.pfx;
      options.passphrase = certOptions.senha || config.certificatePassword;
    } else if (certOptions?.cert && certOptions?.key) {
      options.cert = certOptions.cert;
      options.key = certOptions.key;
    } else {
      throw new Error('Certificado não carregado para consulta de resultado da SEFAZ.');
    }

    return await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log('==== [consultarResultadoLote] RESPOSTA SEFAZ ====', res.statusCode, res.headers);
          console.log('==== [consultarResultadoLote] BODY ====', data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', (error) => {
        console.error('==== [consultarResultadoLote] ERRO ====', error);
        reject(error);
      });

      req.write(xmlConsulta);
      req.end();
    });
  }

  gerarEnvelopeConsultaResultado(numeroRecibo, ambiente = 'homologacao') {
    const codigoAmbiente = ambiente === 'producao' ? '1' : '2';
    const nsResultado = ambiente === 'producao'
      ? 'http://www.gnre.pe.gov.br/webservice/GnreResultadoLote'
      : 'http://www.testegnre.pe.gov.br/webservice/GnreResultadoLote';

    const xml = create({
      'soapenv:Envelope': {
        '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
        '@xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
        '@xmlns:gnre': 'http://www.gnre.pe.gov.br/wsdl/consultar',

        'soapenv:Header': {
          'gnre:gnreCabecMsg': {
            'versaoDados': '2.00'
          }
        },

        'soapenv:Body': {
          'gnre:gnreDadosMsg': {
            'TConsLote_GNRE': {
              '@xmlns': 'http://www.gnre.pe.gov.br',

              'ambiente': codigoAmbiente,

              'numeroRecibo': String(numeroRecibo || '')
                .replace(/\D/g, '')
            }
          }
        }
      }
    });

    return xml.end({ prettyPrint: true });
  }

  async gerarEnvelopeSOAP(dados, ambiente = 'homologacao', opcoes = {}) {

    const versaoDados = String(opcoes?.versaoDados || '2.00');
    const usarNamespaceCabecalhoWsdl = Boolean(opcoes?.usarNamespaceCabecalhoWsdl);
    const versaoLayout = String(opcoes?.versaoLayout || '2.00');
    const formatoSoap = String(opcoes?.formatoSoap || 'axis-cdata');
    const loteNamespaceV2 = String(opcoes?.loteNamespaceV2 || 'http://www.gnre.pe.gov.br');

    const ufFavorecidaV2 = String(dados.ufFavorecida || '').trim().toUpperCase();
    const receita6 = String(dados.receita || '').replace(/\D/g, '').slice(0, 6).padStart(6, '0');
    const documentoEmitente = String(dados.documentoEmitente || '').replace(/\D/g, '');
    const documentoDestinatario = String(dados.documentoDestinatario || '').replace(/\D/g, '');
    const documentoOrigem = String(dados.documentoOrigem || '').replace(/\D/g, '').slice(0, 60) || '0';

    const nsRecepcao = ambiente === 'producao'
      ? 'http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao'
      : 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao';
    const namespaceServicoRecepcao = String(opcoes?.namespaceServicoRecepcao || nsRecepcao);

    const ufFavorecidaIbge = ufSiglaParaCodigoIbge(ufFavorecidaV2) || ufFavorecidaV2;

    const loteGnreObjeto = versaoLayout === '1.00'
      ? {
        'TLote_GNRE': {
          '@xmlns': 'http://www.gnre.pe.gov.br',
          'guias': {
            'TDadosGNRE': {
              'c01_UfFavorecida': ufFavorecidaIbge,
              'c02_receita': receita6,
              'c27_tipoIdentificacaoEmitente': dados.tipoDocEmitente,
              'c03_idContribuinteEmitente': dados.tipoDocEmitente === '2'
                ? { CPF: documentoEmitente }
                : { CNPJ: documentoEmitente },
              'c28_tipoDocOrigem': '10',
              'c04_docOrigem': documentoOrigem,
              'c06_valorPrincipal': dados.valorPrincipal,
              'c10_valorTotal': dados.valorTotal,
              'c14_dataVencimento': dados.dataVencimento,
              'c16_razaoSocialEmitente': String(dados.razaoSocialEmitente || '').slice(0, 60),
              'c34_tipoIdentificacaoDestinatario': dados.tipoDocDestinatario,
              'c35_idContribuinteDestinatario': dados.tipoDocDestinatario === '2'
                ? { CPF: documentoDestinatario }
                : { CNPJ: documentoDestinatario },
              'c37_razaoSocialDestinatario': String(dados.razaoSocialDestinatario || '').slice(0, 60)
            }
          }
        }
      }
      : {
        'TLote_GNRE': {
          '@versao': '2.00',
          '@xmlns': loteNamespaceV2,
          'guias': {
            'TDadosGNRE': {
              '@versao': '2.00',
              'ufFavorecida': ufFavorecidaV2,
              'tipoGnre': '0',
              'contribuinteEmitente': {
                'identificacao': dados.tipoDocEmitente === '2'
                  ? { CPF: documentoEmitente }
                  : { CNPJ: documentoEmitente },
                'razaoSocial': dados.razaoSocialEmitente,
                ...(dados.enderecoEmitente ? { endereco: String(dados.enderecoEmitente).slice(0, 60) } : {}),
                ...(dados.municipioEmitente ? { municipio: String(dados.municipioEmitente) } : {}),
                ...(dados.ufEmitente ? { uf: String(dados.ufEmitente).toUpperCase().slice(0, 2) } : {}),
                ...(dados.cepEmitente ? { cep: String(dados.cepEmitente).slice(0, 8) } : {})
              },
              'itensGNRE': {
                'item': {
                  'receita': receita6,
                  'documentoOrigem': {
                    '@tipo': '10',
                    '#': documentoOrigem
                  },
                  'referencia': {
                    'periodo': String(dados.referenciaPeriodo || '0'),
                    'mes': String(dados.referenciaMes || '').padStart(2, '0').slice(0, 2),
                    'ano': String(dados.referenciaAno || '').slice(0, 4)
                  },
                  'dataVencimento': dados.dataVencimento,
                  'valor': [
                    { '@tipo': '11', '#': dados.valorPrincipal },
                    { '@tipo': '21', '#': dados.valorTotal }
                  ],
                  'contribuinteDestinatario': {
                    'identificacao': dados.tipoDocDestinatario === '2'
                      ? { CPF: documentoDestinatario }
                      : { CNPJ: documentoDestinatario },
                    'razaoSocial': dados.razaoSocialDestinatario,
                    ...(dados.municipioDestinatario ? { municipio: String(dados.municipioDestinatario) } : {})
                  }
                }
              },
              'valorGNRE': dados.valorTotal,
              'dataPagamento': String(dados.dataPagamento || dados.dataVencimento || ''),
              'identificadorGuia': '1'
            }
          }
        }
      };

    if (formatoSoap === 'soap12-direct') {
      const namespaceCabecalho = usarNamespaceCabecalhoWsdl
        ? 'http://www.gnre.pe.gov.br/wsdl/processar'
        : nsRecepcao;

      const xmlDireto = create({
        'soap12:Envelope': {
          '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          '@xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
          '@xmlns:soap12': 'http://www.w3.org/2003/05/soap-envelope',
          'soap12:Header': {
            'gnreCabecMsg': {
              '@xmlns': namespaceCabecalho,
              'versaoDados': versaoDados,
            }
          },
          'soap12:Body': {
            'gnreDadosMsg': {
              '@xmlns': namespaceServicoRecepcao,
              ...loteGnreObjeto
            }
          }
        }
      });

      return xmlDireto.end({ prettyPrint: false });
    }


    const xmlInterno = versaoLayout === '1.00'
  ? create(loteGnreObjeto).end({ prettyPrint: false, headless: true })
  : this.gerarXmlDadosGnreV2(dados, loteNamespaceV2);

    const namespaceCabecalho = usarNamespaceCabecalhoWsdl
      ? 'http://www.gnre.pe.gov.br/wsdl/processar'
      : nsRecepcao;

    const cabecalhoAbertura = `<gnreCabecMsg xmlns="${namespaceCabecalho}">`;
    const cabecalhoFechamento = '</gnreCabecMsg>';

    if (formatoSoap === 'soap12-direct-cdata') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    ${cabecalhoAbertura}
      <versaoDados>${versaoDados}</versaoDados>
    ${cabecalhoFechamento}
  </soap12:Header>
  <soap12:Body>
    <gnreDadosMsg xmlns="${namespaceServicoRecepcao}"><![CDATA[${xmlInterno}]]></gnreDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
    }

    if (formatoSoap === 'soap12-axis-cdata') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:gnre="${nsRecepcao}" xmlns:wsdl="http://www.gnre.pe.gov.br/wsdl/processar">
  <soap12:Header>
    ${cabecalhoAbertura}
      <versaoDados>${versaoDados}</versaoDados>
    ${cabecalhoFechamento}
  </soap12:Header>
  <soap12:Body>
    <gnre:processar>
      <gnre:gnreDadosMsg><![CDATA[${xmlInterno}]]></gnre:gnreDadosMsg>
    </gnre:processar>
  </soap12:Body>
</soap12:Envelope>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gnre="${nsRecepcao}" xmlns:wsdl="http://www.gnre.pe.gov.br/wsdl/processar">
  <soapenv:Header>
    ${cabecalhoAbertura}
      <versaoDados>${versaoDados}</versaoDados>
    ${cabecalhoFechamento}
  </soapenv:Header>
  <soapenv:Body>
    <gnre:processar>
      <gnre:gnreDadosMsg><![CDATA[${xmlInterno}]]></gnre:gnreDadosMsg>
    </gnre:processar>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  
}

export default new GnreProcessoController();

