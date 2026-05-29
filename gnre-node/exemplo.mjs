/**
 * exemplo.mjs — demonstra o uso da biblioteca gnre-node
 * Execute com: node gnre-node/exemplo.mjs
 *
 * Equivalente ao sped-gnre/exemplos/enviar-lote-sefaz.php
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Guia }       from './src/Guia.mjs';
import { LoteV2 }     from './src/LoteV2.mjs';
import { Consulta }   from './src/Consulta.mjs';
import { ConfigUf }   from './src/ConfigUf.mjs';
import { Connection } from './src/Connection.mjs';
import { Setup }      from './src/Setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 1. Configuração do certificado ──────────────────────────────────────────

class MinhaConfiguracao extends Setup {
  getBaseUrl()            { return 'https://www.testegnre.pe.gov.br'; }
  getCertificateCnpj()    { return '36769602005700'; }
  getCertificatePassword(){ return process.env.SENHA || '#GTO@2026#'; }
  getCertificatePemFile() { return process.env.CERT_CERT_PATH || ''; }
  getPrivateKey()         { return process.env.CERT_KEY_PATH  || ''; }
  getEnvironment()        { return 2; } // 2 = homologação

  // Quando usar PFX em vez de PEM:
  getCertificatePfxBuffer() {
    const pfxPath = process.env.CERT_PFX_PATH
      || path.resolve(__dirname, '../GTO COMERCIO 2026-2027.pfx');
    if (fs.existsSync(pfxPath)) return fs.readFileSync(pfxPath);
    return null;
  }

  getDebug() { return false; }
}

// ── 2. Montar a guia (equivalente ao objeto Guia do PHP) ────────────────────

const guia = new Guia();

// UF de destino (favorecida)
guia.c01_UfFavorecida = 'MA';

// Código de receita: 100102 = DIFAL, 100120 = FCP, 100099 = ICMS-ST
guia.c02_receita = '100102';

// Emitente
guia.c27_tipoIdentificacaoEmitente = 1; // 1=CNPJ, 2=CPF
guia.c03_idContribuinteEmitente    = '36769602005700';
guia.c16_razaoSocialEmitente       = 'GTO COMERCIO ATACADISTA DE CONFECCOES E CALCADOS LTDA';
guia.c18_enderecoEmitente          = 'SN';
guia.c19_municipioEmitente         = '53001'; // Brasília (5 dígitos GNRE)
guia.c20_ufEnderecoEmitente        = 'DF';
guia.c21_cepEmitente               = '71720510';

// Documento de origem
guia.c28_tipoDocOrigem = 10;            // 10 = NF-e
guia.c04_docOrigem     = '53260536769602005700550000000147921506192504'; // chave NF-e

// Valores
guia.c06_valorPrincipal = '28.80';
guia.c10_valorTotal     = '28.80';

// Datas
guia.c14_dataVencimento = '2026-05-29';
guia.c33_dataPagamento  = '2026-05-29';

// Referência (período de apuração)
guia.periodo  = '0';
guia.mes      = '05';
guia.ano      = 2026;

// Destinatário
guia.c34_tipoIdentificacaoDestinatario = 1; // 1=CNPJ
guia.c35_idContribuinteDestinatario    = '05761069000151';
guia.c37_razaoSocialDestinatario       = 'SOCIEDADE MARANHENSE DE DIREITOS HUMANOS';
guia.c38_municipioDestinatario         = '21113'; // São Luís (5 dígitos)

// Campos extras: código 113 = chave da NF-e
guia.c39_camposExtras = [
  { campoExtra: { codigo: 113, valor: '53260536769602005700550000000147921506192504' } },
];

// ── 3. Montar o lote e gerar o XML ──────────────────────────────────────────

const lote = new LoteV2();
lote.utilizarAmbienteDeTeste(true); // usar homologação
lote.addGuia(guia);

const xml = lote.toXml();
console.log('=== XML gerado ===');
console.log(xml);

// ── 4. Enviar para a SEFAZ ──────────────────────────────────────────────────

const setup = new MinhaConfiguracao();
const conn  = new Connection(setup, lote.getHeaderSoap(), xml);

console.log('\n=== Enviando para SEFAZ ===');
console.log('URL:', lote.soapAction());

try {
  const resposta = await conn.doRequest(lote.soapAction());
  console.log('\n=== Resposta SEFAZ ===');
  console.log(resposta);

  // Extrair número de recibo da resposta (para consulta posterior)
  const recibo = resposta.match(/<(?:\w+:)?numero[^>]*>(\d+)<\/(?:\w+:)?numero>/i)?.[1];
  if (recibo) {
    console.log('\n=== Recibo:', recibo, '===');
    await consultarLote(recibo, setup);
  }
} catch (err) {
  console.error('Erro ao enviar:', err.message);
}

// ── 5. Consultar resultado do lote ──────────────────────────────────────────

async function consultarLote(recibo, cfg) {
  const consulta = new Consulta();
  consulta.setRecibo(recibo);
  consulta.setEnvironment(2); // 2 = homologação
  consulta.utilizarAmbienteDeTeste(true);

  const connConsulta = new Connection(cfg, consulta.getHeaderSoap(), consulta.toXml());

  console.log('\n=== Consultando lote ===');
  try {
    const resp = await connConsulta.doRequest(consulta.soapAction());
    console.log(resp);
  } catch (err) {
    console.error('Erro na consulta:', err.message);
  }
}

// ── 6. Consultar configuração de UF (municípios aceitos) ────────────────────

async function consultarConfigUf() {
  const cfg    = new MinhaConfiguracao();
  const cfgUf  = new ConfigUf();
  cfgUf.setEstado('MA');
  cfgUf.setReceita('100102');
  cfgUf.setEnvironment(2);
  cfgUf.utilizarAmbienteDeTeste(true);

  const connCfg = new Connection(cfg, cfgUf.getHeaderSoap(), cfgUf.toXml());

  console.log('\n=== Consultando config UF (MA) ===');
  try {
    const resp = await connCfg.doRequest(cfgUf.soapAction());
    console.log(resp);
  } catch (err) {
    console.error('Erro na consulta ConfigUF:', err.message);
  }
}

// Descomente a linha abaixo para testar a consulta de configuração de UF:
// await consultarConfigUf();
