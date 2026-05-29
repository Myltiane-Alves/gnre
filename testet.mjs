// teste-gnre.mjs  — rode com: node testet.mjs
import https from 'https';
import fs from 'fs';
import axios from 'axios';

const pfx = fs.readFileSync('./GTO COMERCIO 2026-2027.pfx');
const senha = '#GTO@2026#';
const httpsAgent = new https.Agent({ pfx, passphrase: senha, rejectUnauthorized: false });

const xmlConfigUF = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:gnr="http://www.gnre.pe.gov.br/webservice/GnreConfigUF">
  <soap12:Header>
    <gnr:gnreCabecMsg><gnr:versaoDados>2.00</gnr:versaoDados></gnr:gnreCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <gnr:gnreDadosMsg>
      <TConsultaConfigUf xmlns="http://www.gnre.pe.gov.br">
        <ambiente>2</ambiente>
        <uf>MA</uf>
        <receita>100102</receita>
      </TConsultaConfigUf>
    </gnr:gnreDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

// Testa se o portal aceita código de município com 7 dígitos IBGE
const xmlLote7dig = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao">
      <versaoDados>2.00</versaoDados>
    </gnreCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <gnreDadosMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreLoteRecepcao">
      <TLote_GNRE versao="2.00" xmlns="http://www.gnre.pe.gov.br">
        <guias>
          <TDadosGNRE versao="2.00">
            <ufFavorecida>MA</ufFavorecida>
            <tipoGnre>0</tipoGnre>
            <contribuinteEmitente>
              <identificacao><CNPJ>36769602005700</CNPJ></identificacao>
              <razaoSocial>GTO COMERCIO ATACADISTA DE CONFECCOES E CALCADOS LTDA</razaoSocial>
              <endereco>SN</endereco>
              <municipio>5300108</municipio>
              <uf>DF</uf>
              <cep>71720510</cep>
            </contribuinteEmitente>
            <itensGNRE>
              <item>
                <receita>100102</receita>
                <documentoOrigem tipo="10">14792</documentoOrigem>
                <referencia><periodo>0</periodo><mes>05</mes><ano>2026</ano></referencia>
                <dataVencimento>2026-05-29</dataVencimento>
                <valor tipo="11">179.98</valor>
                <valor tipo="21">179.98</valor>
                <produto>33</produto>
                <convenio>0</convenio>
                <contribuinteDestinatario>
                  <identificacao><CNPJ>05761069000151</CNPJ></identificacao>
                  <razaoSocial>SOCIEDADE MARANHENSE DE DIREITOS HUMANOS</razaoSocial>
                  <municipio>2111300</municipio>
                </contribuinteDestinatario>
                <camposExtras>
                  <campoExtra><codigo>113</codigo><valor>53260536769602005700550000000147921506192504</valor></campoExtra>
                </camposExtras>
              </item>
            </itensGNRE>
            <valorGNRE>179.98</valorGNRE>
            <dataPagamento>2026-05-29</dataPagamento>
            <identificadorGuia>1</identificadorGuia>
          </TDadosGNRE>
        </guias>
      </TLote_GNRE>
    </gnreDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

try {
  const resp = await axios.post(
    'https://www.testegnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao',
    xmlLote7dig,
    { httpsAgent, headers: { 'Content-Type': 'application/soap+xml;charset=utf-8;action="processar"' } }
  );
  console.log(resp.data);
} catch (err) {
  console.error('STATUS:', err?.response?.status);
  console.error('DATA:', err?.response?.data);
  console.error('MSG:', err.message);
}

const endpoint = 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao';
const action = 'http://www.testegnre.pe.gov.br/webservice/GnreRecepcaoLote';

class Teste {

    async processar() {
        // XML minimalista — só os campos obrigatórios
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <soap12:Envelope
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Header>
        <gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/wsdl/processar">
        <versaoDados>1.00</versaoDados>
        </gnreCabecMsg>
    </soap12:Header>
    <soap12:Body>
        <gnreDadosMsg xmlns="http://www.gnre.pe.gov.br/wsdl/processar">
        <TLote_GNRE xmlns="http://www.gnre.pe.gov.br">
            <guias>
            <TDadosGNRE>
                <c01_UfFavorecida>MA</c01_UfFavorecida>
                <c02_receita>100102</c02_receita>
                <c03_idContribuinteEmitente>36769602005700</c03_idContribuinteEmitente>
                <c04_docOrigem>53260536769602005700550000000147921506192504</c04_docOrigem>
                <c06_valorPrincipal>28.80</c06_valorPrincipal>
                <c10_valorTotal>28.80</c10_valorTotal>
                <c14_dataVencimento>2026-05-29</c14_dataVencimento>
                <c16_razaoSocialEmitente>GTO COMERCIO ATACADISTA DE CONFECCOES E CALCADOS LTDA</c16_razaoSocialEmitente>
                <c20_ufEnderecoEmitente>DF</c20_ufEnderecoEmitente>
                <c21_cepEmitente>71720510</c21_cepEmitente>
                <c27_tipoIdentificacaoEmitente>1</c27_tipoIdentificacaoEmitente>
                <c28_tipoDocOrigem>10</c28_tipoDocOrigem>
                <c34_tipoIdentificacaoDestinatario>1</c34_tipoIdentificacaoDestinatario>
                <c35_idContribuinteDestinatario>05761069000151</c35_idContribuinteDestinatario>
            </TDadosGNRE>
            </guias>
        </TLote_GNRE>
        </gnreDadosMsg>
    </soap12:Body>
    </soap12:Envelope>`;

        const buf = Buffer.from(xml, 'utf-8');
        const url = new URL(endpoint);

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            pfx,
            passphrase: senha,
            rejectUnauthorized: false,
            headers: {
                'Content-Type': `application/soap+xml;charset=utf-8;action="${action}"`,
                'Content-Length': buf.length,
            },
        };

        const req = https.request(options, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                console.log('STATUS:', res.statusCode);
                console.log('RESPOSTA:\n', Buffer.concat(chunks).toString('utf-8'));
            });
        });

        req.on('error', e => console.error('ERRO:', e.message));
        req.write(buf);
        req.end();
    }
}

export default Teste;