import { Router }         from 'express';
import fs                  from 'fs';
import path                from 'path';
import { fileURLToPath }   from 'url';
import { v4 as uuidv4 }    from 'uuid';
import 'dotenv/config';

import { Guia }       from './src/Guia.mjs';
import { Lote }       from './src/Lote.mjs';
import { LoteV2 }     from './src/LoteV2.mjs';
import { Consulta }   from './src/Consulta.mjs';
import { Connection } from './src/Connection.mjs';
import { Setup }      from './src/Setup.mjs';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const RETORNOS_DIR = path.resolve(__dirname, 'retornos');

if (!fs.existsSync(RETORNOS_DIR)) fs.mkdirSync(RETORNOS_DIR, { recursive: true });

// ── Certificado ───────────────────────────────────────────────────────────────

class GnreSetup extends Setup {
  getBaseUrl()             { return 'https://www.testegnre.pe.gov.br'; }
  getCertificateCnpj()     { return process.env.CERT_CNPJ || ''; }
  getCertificatePassword() { return process.env.SENHA || '#GTO@2026#'; }
  getCertificatePemFile()  { return process.env.CERT_CERT_PATH || ''; }
  getPrivateKey()          { return process.env.CERT_KEY_PATH  || ''; }
  getEnvironment()         { return 2; }

  getCertificatePfxBuffer() {
    if (process.env.CERT_PFX_BASE64) {
      try {
        const buf = Buffer.from(process.env.CERT_PFX_BASE64, 'base64');
        if (buf.length > 0) return buf;
      } catch {}
    }
    const pfxPath = process.env.CERT_PFX_PATH
      || path.resolve(__dirname, '../GTO COMERCIO 2026-2027.pfx');
    if (fs.existsSync(pfxPath)) return fs.readFileSync(pfxPath);
    return null;
  }

  getDebug() { return false; }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function somenteDigitos(v = '') { return String(v || '').replace(/\D/g, ''); }

function tagXml(nome, src = '') {
  const m = String(src || '').match(
    new RegExp(`<(?:\\w+:)?${nome}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${nome}>`, 'i')
  );
  return m?.[1]?.replace(/&#x[\dA-Fa-f]+;/g, c =>
    String.fromCharCode(parseInt(c.slice(3, -1), 16))
  ).trim() || null;
}

function parsearResposta(xml) {
  const isFault   = /<(?:\w+:)?Fault\b/i.test(xml);
  const situacao  = tagXml('situacaoRecepcao', xml);
  const codigo    = tagXml('codigo',    situacao || xml);
  const descricao = tagXml('descricao', situacao || xml);
  const reciboBloco = tagXml('recibo', xml);
  const recibo    = reciboBloco ? (somenteDigitos(tagXml('numero', reciboBloco)) || null) : null;
  const ambiente  = tagXml('ambiente', xml);
  const faultMsg  = isFault ? (tagXml('Text', xml) || tagXml('faultstring', xml)) : null;
  return { isFault, faultMsg, codigo, descricao, recibo, ambiente };
}

function salvarXml(xml, tipo, chave = '') {
  try {
    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    const nome = `${tipo}${chave ? '_' + chave.slice(0, 10) : ''}_${ts}.xml`;
    const arq  = path.join(RETORNOS_DIR, nome);
    fs.writeFileSync(arq, xml, 'utf8');
    return path.relative(process.cwd(), arq).replace(/\\/g, '/');
  } catch {
    return null;
  }
}

// Envelope SOAP 1.1 (fallback axis-cdata)
function envelopeSoap11(loteXml, teste = true) {
  const ns = teste
    ? 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao'
    : 'http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao';
  return `<?xml version="1.0" encoding="UTF-8"?>\
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gnre="${ns}" xmlns:wsdl="http://www.gnre.pe.gov.br/wsdl/processar">\
<soapenv:Header>\
<gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/wsdl/processar"><versaoDados>2.00</versaoDados></gnreCabecMsg>\
</soapenv:Header>\
<soapenv:Body>\
<gnre:processar>\
<gnre:gnreDadosMsg><![CDATA[${loteXml}]]></gnre:gnreDadosMsg>\
</gnre:processar>\
</soapenv:Body>\
</soapenv:Envelope>`;
}

// Envelope SOAP 1.2 com versaoDados=1.00 (fallback header v1)
function envelopeSoap12v1(loteXml, teste = true) {
  const ns = teste
    ? 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao'
    : 'http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao';
  return `<?xml version="1.0" encoding="UTF-8"?>\
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:gnre="${ns}" xmlns:wsdl="http://www.gnre.pe.gov.br/wsdl/processar">\
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

// ── Mapeamento venda → Guia ───────────────────────────────────────────────────

function vendaParaGuia(venda) {
  const guia  = new Guia();
  const agora = new Date();
  const valorGnre = String(Number(venda.valorGnre ?? venda.valorNota ?? 0).toFixed(2));

  guia.c01_UfFavorecida                  = venda.destinatario?.UF || '';
  guia.c02_receita                       = String(venda.receita || '100102');
  guia.c27_tipoIdentificacaoEmitente     = venda.emitente?.CNPJ ? 1 : 2;
  guia.c03_idContribuinteEmitente        = somenteDigitos(venda.emitente?.CNPJ || venda.emitente?.CPF || '');
  guia.c16_razaoSocialEmitente           = String(venda.emitente?.xNome || '').slice(0, 60);
  guia.c18_enderecoEmitente              = String(venda.emitente?.xLgr || '').slice(0, 60);
  guia.c19_municipioEmitente             = somenteDigitos(venda.emitente?.municipioEmitente || '').slice(0, 5) || null;
  guia.c20_ufEnderecoEmitente            = venda.emitente?.state || venda.emitente?.UF || '';
  guia.c21_cepEmitente                   = somenteDigitos(venda.emitente?.CEP || '').slice(0, 8);
  guia.c22_telefoneEmitente              = somenteDigitos(venda.emitente?.fone || '');
  guia.c28_tipoDocOrigem                 = 10;
  guia.c04_docOrigem                     = somenteDigitos(venda.chave || '').slice(0, 44);
  guia.c06_valorPrincipal                = valorGnre;
  guia.c10_valorTotal                    = valorGnre;
  guia.c14_dataVencimento                = venda.dataVencimento || agora.toISOString().split('T')[0];
  guia.c33_dataPagamento                 = venda.dataPagamento  || agora.toISOString().split('T')[0];
  guia.c34_tipoIdentificacaoDestinatario = venda.destinatario?.CNPJ ? 1 : 2;
  guia.c35_idContribuinteDestinatario    = somenteDigitos(venda.destinatario?.CNPJ || venda.destinatario?.CPF || '');
  guia.c37_razaoSocialDestinatario       = String(venda.destinatario?.xNomeDestinatario || venda.destinatario?.xNome || '').slice(0, 60);
  guia.c38_municipioDestinatario         = somenteDigitos(venda.destinatario?.municipioDestinatario || '').slice(0, 5) || null;
  guia.periodo                           = '0';
  guia.mes                               = String(agora.getMonth() + 1).padStart(2, '0');
  guia.ano                               = agora.getFullYear();
  guia.c39_camposExtras                  = [
    { campoExtra: { codigo: 113, tipo: 'C', valor: somenteDigitos(venda.chave || '') } },
  ];

  return guia;
}

// ── Envio com fallback multi-formato ─────────────────────────────────────────

const CODIGOS_FALLBACK = new Set(['104', '303']);

async function enviarGnreParaSefaz(venda) {
  const guia  = vendaParaGuia(venda);
  const lote  = new LoteV2();
  lote.utilizarAmbienteDeTeste(true);
  lote.addGuia(guia);

  const setup    = new GnreSetup();
  const loteXml  = lote.gerarXmlLote();
  const chaveNfe = somenteDigitos(venda.chave || '').slice(0, 10);
  const urlEnvio = lote.soapAction();

  // v1 data format (old field names: c01_UfFavorecida, c02_receita, …)
  const loteV1 = new Lote();
  loteV1.utilizarAmbienteDeTeste(true);
  loteV1.addGuia(guia);
  const loteXmlV1 = loteV1.gerarXmlLote();

  const soap11v1 = envelopeSoap11(loteXmlV1, true)
    .replace('<versaoDados>2.00</versaoDados>', '<versaoDados>1.00</versaoDados>');

  const tentativas = [
    // ── v2 data, SOAP 1.2, versaoDados 2.00 ──
    { nome: 'soap12-v2-h2', headers: lote.getHeaderSoap(),  xml: lote.toXml() },
    // ── v2 data, SOAP 1.2, versaoDados 1.00 ──
    { nome: 'soap12-v2-h1', headers: lote.getHeaderSoap(),  xml: envelopeSoap12v1(loteXml, true) },
    // ── v2 data, SOAP 1.1, versaoDados 2.00 ──
    {
      nome:    'soap11-v2-h2',
      headers: ['Content-Type: text/xml; charset=utf-8', `SOAPAction: "${urlEnvio}/processar"`],
      xml:     envelopeSoap11(loteXml, true),
    },
    // ── v2 data, SOAP 1.1, versaoDados 1.00 ──
    {
      nome:    'soap11-v2-h1',
      headers: ['Content-Type: text/xml; charset=utf-8', `SOAPAction: "${urlEnvio}/processar"`],
      xml:     envelopeSoap11(loteXml, true).replace('<versaoDados>2.00</versaoDados>', '<versaoDados>1.00</versaoDados>'),
    },
    // ── v1 data (c01_/c02_…), SOAP 1.2, versaoDados 1.00 ──
    { nome: 'soap12-v1', headers: loteV1.getHeaderSoap(), xml: loteV1.toXml() },
    // ── v1 data, SOAP 1.1, versaoDados 1.00 ──
    {
      nome:    'soap11-v1',
      headers: ['Content-Type: text/xml; charset=utf-8', `SOAPAction: "${urlEnvio}/processar"`],
      xml:     soap11v1,
    },
  ];

  let respostaBruta  = null;
  let parsed         = null;
  let tentativaUsada = null;
  const historico    = [];

  for (const t of tentativas) {
    salvarXml(t.xml, `envio_${t.nome}`, chaveNfe);

    try {
      const conn = new Connection(setup, t.headers, t.xml);
      respostaBruta = await conn.doRequest(urlEnvio);
    } catch (err) {
      historico.push({ tentativa: t.nome, erro: err.message });
      continue;
    }

    salvarXml(respostaBruta, `retorno_${t.nome}`, chaveNfe);

    parsed         = parsearResposta(respostaBruta);
    tentativaUsada = t.nome;

    historico.push({
      tentativa:   t.nome,
      codigo:      parsed.codigo,
      descricao:   parsed.descricao,
      isFault:     parsed.isFault,
      faultMsg:    parsed.faultMsg,
    });

    const ehFalha = parsed.isFault || CODIGOS_FALLBACK.has(parsed.codigo || '');
    if (!ehFalha) break;
  }

  let consulta        = null;
  let arquivoConsulta = null;

  if (parsed?.recibo) {
    try {
      const cons = new Consulta();
      cons.setRecibo(parsed.recibo);
      cons.setEnvironment(2);
      cons.utilizarAmbienteDeTeste(true);
      const connCons = new Connection(setup, cons.getHeaderSoap(), cons.toXml());
      const respostaConsulta = await connCons.doRequest(cons.soapAction());
      arquivoConsulta = salvarXml(respostaConsulta, 'consulta', chaveNfe);
      consulta = parsearResposta(respostaConsulta);
      consulta._xml = respostaConsulta;
    } catch (err) {
      consulta = { erro: err.message };
    }
  }

  const sucesso = !parsed?.isFault && parsed?.codigo === '100';

  return {
    sucesso,
    tentativa:   tentativaUsada,
    recibo:      parsed?.recibo    || null,
    codigo:      parsed?.codigo    || null,
    descricao:   parsed?.descricao || null,
    ambiente:    parsed?.ambiente  || null,
    erro:        !sucesso ? (parsed?.faultMsg || parsed?.descricao || 'Erro desconhecido') : null,
    consulta:    consulta || null,
    historico,
    respostaSefaz: respostaBruta,
  };
}

// ── Store em memória ──────────────────────────────────────────────────────────

const vendas = new Map();

// ── Rotas ─────────────────────────────────────────────────────────────────────

const router = new Router();

// GET /ping — health check
router.get('/ping', (_req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    retornos:  RETORNOS_DIR,
  });
});

// POST /vendas/gnre — gerar e enviar GNRE diretamente do JSON
router.post('/vendas/gnre', async (req, res) => {
  try {
    const venda = req.body;
    if (!venda?.chave || !venda?.emitente || !venda?.destinatario) {
      return res.status(400).json({
        sucesso:  false,
        mensagem: 'Campos obrigatórios: chave, emitente, destinatario',
      });
    }
    const resultado = await enviarGnreParaSefaz(venda);
    const status    = resultado.sucesso ? 200 : 422;
    return res.status(status).json(resultado);
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
});

// POST /vendas — criar e armazenar venda
router.post('/vendas', (req, res) => {
  try {
    const dados = req.body;
    if (!dados?.chave || !dados?.emitente) {
      return res.status(400).json({ mensagem: 'Campos obrigatórios: chave, emitente' });
    }
    const id    = uuidv4();
    const venda = { id, ...dados, criadoEm: new Date().toISOString() };
    vendas.set(id, venda);
    return res.status(201).json(venda);
  } catch (error) {
    return res.status(500).json({ mensagem: error.message });
  }
});

// GET /vendas
router.get('/vendas', (_req, res) => res.json([...vendas.values()]));

// GET /vendas/:id
router.get('/vendas/:id', (req, res) => {
  const venda = vendas.get(req.params.id);
  if (!venda) return res.status(404).json({ mensagem: 'Venda não encontrada' });
  return res.json(venda);
});

// PUT /vendas/:id
router.put('/vendas/:id', (req, res) => {
  const { id } = req.params;
  if (!vendas.has(id)) return res.status(404).json({ mensagem: 'Venda não encontrada' });
  const atualizada = { ...vendas.get(id), ...req.body, id, atualizadoEm: new Date().toISOString() };
  vendas.set(id, atualizada);
  return res.json(atualizada);
});

// DELETE /vendas/:id
router.delete('/vendas/:id', (req, res) => {
  const { id } = req.params;
  if (!vendas.has(id)) return res.status(404).json({ mensagem: 'Venda não encontrada' });
  vendas.delete(id);
  return res.status(204).send();
});

// POST /vendas/:id/gnre — enviar GNRE de venda armazenada
router.post('/vendas/:id/gnre', async (req, res) => {
  try {
    const venda = vendas.get(req.params.id);
    if (!venda) return res.status(404).json({ mensagem: 'Venda não encontrada' });
    const resultado = await enviarGnreParaSefaz({ ...venda, ...req.body });
    const status    = resultado.sucesso ? 200 : 422;
    return res.status(status).json(resultado);
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
});

export default router;
