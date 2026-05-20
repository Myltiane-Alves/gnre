import fs from 'fs';
import https from 'https';
import { create } from 'xmlbuilder2';
import axios from 'axios';
import 'dotenv/config';

const url = process.env.API_URL;

// Configuração inicial
const config = {
  sefazUrl: {
    homologacao: 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreConfigUF',
    producao: 'https://www.gnre.pe.gov.br/gnreWS/services/GnreConfigUF',
  },
  certificatePath: './certs/certificate.pfx',
  certificatePassword: 'senha123',
};

// Função para gerar o envelope SOAP
function gerarEnvelopeSOAP(dados) {
  const xml = create({
    Envelope: {
      '@xmlns': 'http://www.w3.org/2003/05/soap-envelope',
      Header: {},
      Body: {
        enviarLote: {
          '@xmlns': 'http://www.gnre.pe.gov.br',
          lote: {
            guia: {
              c01_UfFavorecida: dados.ufFavorecida,
              c02_receita: dados.receita,
              c06_valorPrincipal: dados.valorPrincipal,
              c10_valorTotal: dados.valorTotal,
              c14_dataVencimento: dados.dataVencimento,
              c16_razaoSocialEmitente: dados.razaoSocialEmitente,
              c37_razaoSocialDestinatario: dados.razaoSocialDestinatario,
            },
          },
        },
      },
    },
  });

  return xml.end({ prettyPrint: true });
}

// Função para enviar o XML para a SEFAZ
function enviarParaSefaz(xml, ambiente = 'homologacao') {
  const sefazUrl = config.sefazUrl[ambiente];

  const options = {
    hostname: new URL(sefazUrl).hostname,
    port: 443,
    path: new URL(sefazUrl).pathname,
    method: 'POST',
    key: fs.readFileSync(config.certificatePath),
    cert: fs.readFileSync(config.certificatePath),
    passphrase: config.certificatePassword,
    headers: {
      'Content-Type': 'application/xml',
      'Content-Length': Buffer.byteLength(xml),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(xml);
    req.end();
  });
}

export async function consultarGnre(req, res) {
  try {
    const { idVenda } = req.query;

    if (!idVenda) {
      return res.status(400).json({ error: 'idVenda é obrigatório' });
    }

    // Buscar dados da venda na API
    const apiUrl = `${url}/api/venda/lista-venda-new-xml.xsjs?id=${idVenda}`;
    const response = await axios.get(apiUrl);
    const vendaData = response.data;

    if (!vendaData || !vendaData.data || vendaData.data.length === 0) {
      return res.status(404).json({ error: 'Venda não encontrada.' });
    }

    const venda = vendaData.data[0]?.venda;
    const ufFavorecida = venda?.NFE_INFNFE_EMIT_ENDEREMIT_UF;
    const receita = venda?.RECEITA;
    const valorPrincipal = venda?.VALOR_PRINCIPAL;
    const valorTotal = venda?.VALOR_TOTAL;
    const dataVencimento = venda?.DATA_VENCIMENTO;
    const razaoSocialEmitente = venda?.RAZAO_SOCIAL_EMITENTE;
    const razaoSocialDestinatario = venda?.RAZAO_SOCIAL_DESTINATARIO;

    if (!ufFavorecida || !receita || !valorPrincipal || !valorTotal || !dataVencimento) {
      return res.status(400).json({ error: 'Dados incompletos para consulta GNRE.' });
    }

    // Gerar envelope SOAP para consulta GNRE
    const xmlEnvelope = gerarEnvelopeSOAP({
      ufFavorecida,
      receita,
      valorPrincipal,
      valorTotal,
      dataVencimento,
      razaoSocialEmitente,
      razaoSocialDestinatario,
    });

    // Enviar para a SEFAZ e retornar o conteúdo da resposta
    const respostaSefaz = await enviarParaSefaz(xmlEnvelope, 'homologacao');

    return res.json({
      message: 'Consulta GNRE realizada com sucesso.',
      sefaz: respostaSefaz,
    });
  } catch (error) {
    console.error('Erro ao consultar GNRE:', error);
    return res.status(500).json({ error: 'Erro ao consultar GNRE.' });
  }
}