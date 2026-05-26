// GNRE.js

import fs from 'fs';
import https from 'https';
import axios from 'axios';
import xml2js from 'xml2js';

export default class GNRE {

    constructor() {

        /*
         * HOMOLOGAÇÃO
         */
        this.URL_ENVIO =
            'https://www.testegnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao';

        this.URL_CONSULTA =
            'https://www.testegnre.pe.gov.br/gnreWS/services/GnreResultadoLote';

        /*
         * CERTIFICADO
         */
        this.certificado = fs.readFileSync(
            './GTO COMERCIO 2026-2027.pfx'
        );

        this.senhaCertificado = '#GTO@2026#';

        /*
         * HTTPS AGENT
         */
        this.httpsAgent = new https.Agent({
            pfx: this.certificado,
            passphrase: this.senhaCertificado,
            rejectUnauthorized: false
        });

    }

    removerMascara(valor = '') {

        return String(valor).replace(/\D/g, '');

    }

    /*
     * GERA XML GNRE
     */
    async gerarXML(payload) {

        const emitCnpj =
            this.removerMascara(payload.emitente.CNPJ);

        const destCnpj =
            this.removerMascara(payload.destinatario.CNPJ);

        const valor =
            Number(payload.valorNota)
                .toFixed(2);
        const payloadReceita = payload.receita || '100120';
        const hoje = new Date();

        const ano =
            hoje.getFullYear();

        const mes =
            String(hoje.getMonth() + 1)
                .padStart(2, '0');

        return `
            <TLote_GNRE versao="2.00" xmlns="http://www.gnre.pe.gov.br">
                <guias>
                    <TDadosGNRE versao="2.00">
                        <ufFavorecida>${payload.emitente.state}</ufFavorecida>
                        <tipoGnre>0</tipoGnre>
                        <contribuinteEmitente>
                        <identificacao>
                        <CNPJ>${emitCnpj}</CNPJ>
                        </identificacao>
                        <razaoSocial>${payload.emitente.xNome}</razaoSocial>
                        <endereco>${payload.emitente.xLgr}</endereco>
                        <municipio>${payload.emitente.municipioEmitente}</municipio>
                        <uf>${payload.emitente.state}</uf>
                        <cep>${this.removerMascara(payload.emitente.CEP)}</cep>
                        </contribuinteEmitente>
                        <itensGNRE>
                            <item>
                                <receita>${payloadReceita}</receita>
                                <documentoOrigem tipo="10">${payload.chave}</documentoOrigem>
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
                                        <CNPJ>${destCnpj}</CNPJ>
                                    </identificacao>
                                    <razaoSocial>${payload.destinatario.xNomeDestinatario}</razaoSocial>
                                    <municipio>${payload.destinatario.municipioDestinatario}</municipio>
                                </contribuinteDestinatario>
                            </item>
                        </itensGNRE>
                        <valorGNRE>${valor}</valorGNRE>
                        <dataPagamento>${payload.dataPagamento}</dataPagamento>
                        <identificadorGuia>1</identificadorGuia>
                    </TDadosGNRE>
                </guias>
            </TLote_GNRE>`.trim();

    }

    /*
     * SOAP XML
     */
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

    /*
     * ENVIA GNRE
     */
    async enviarParaSefaz(payload) {

        try {

            /*
             * XML GNRE
             */
            const xmlGNRE =
                await this.gerarXML(payload);

            /*
             * SOAP
             */
            const soapXML =
                await this.montarSOAP(xmlGNRE);

            console.log('\n================ XML GNRE ================\n');
            console.log(xmlGNRE);

            console.log('\n================ SOAP XML ================\n');
            console.log(soapXML);

            /*
             * REQUEST
             */
            const response = await axios.post(
                this.URL_ENVIO,
                soapXML,
                {
                    headers: {

                        'Content-Type':
                            'text/xml; charset=utf-8',
                        SOAPAction: 'processar'

                    },

                    httpsAgent: this.httpsAgent,

                    timeout: 60000

                }
            );

            /*
             * XML RESPOSTA
             */
            const xmlResposta =
                response.data;

            console.log('\n================ XML RESPOSTA ================\n');
            console.log(xmlResposta);

            /*
             * JSON RESPOSTA
             */
            const jsonResposta =
                await xml2js.parseStringPromise(
                    xmlResposta,
                    {
                        explicitArray: false
                    }
                );

            /*
             * RETORNO GNRE
             */
            const retorno =
                jsonResposta?.['soapenv:Envelope']
                    ?.['soapenv:Body']
                    ?.processarResponse
                ?.['ns1:TRetLote_GNRE'];

            /*
             * DADOS RECEPÇÃO
             */
            const situacao =
                retorno?.['ns1:situacaoRecepcao'];

            /*
             * RECIBO
             */
            const recibo =
                retorno?.['ns1:recibo'];

            return {

                success: true,

                ambiente:
                    retorno?.['ns1:ambiente'],

                codigo:
                    situacao?.['ns1:codigo'],

                descricao:
                    situacao?.['ns1:descricao'],

                recibo,

                xmlEnviado:
                    xmlGNRE,

                soapEnviado:
                    soapXML,

                xmlResposta,

                jsonResposta

            };

        } catch (error) {

            console.log('\n================ ERRO GNRE ================\n');

            /*
             * XML ERRO
             */
            const xmlErro =
                error?.response?.data;

            console.log(xmlErro);

            let jsonErro = null;

            /*
             * TENTA CONVERTER XML
             */
            if (xmlErro) {

                try {

                    jsonErro =
                        await xml2js.parseStringPromise(
                            xmlErro,
                            {
                                explicitArray: false
                            }
                        );

                } catch (e) {

                    jsonErro = xmlErro;

                }

            }

            return {

                success: false,

                statusCode:
                    error?.response?.status,

                message:
                    error.message,

                xmlErro,

                jsonErro

            };

        }

    }

    /*
     * CONSULTA LOTE
     */
    async consultarLote(numeroRecibo) {

        try {

            numeroRecibo =
                String(numeroRecibo)
                    .padStart(16, '0');

            const xmlConsulta = `<?xml version="1.0" encoding="utf-8"?>
                <soapenv:Envelope
                        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                        xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                        xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">

                    <soapenv:Header>
                        <gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreResultadoLote">
                            <versaoDados>2.00</versaoDados>
                        </gnreCabecMsg>
                    </soapenv:Header>

                    <soapenv:Body>
                        <gnreDadosMsg xmlns="http://www.gnre.pe.gov.br/webservice/GnreResultadoLote">
                            <TConsultaLote_GNRE xmlns="http://www.gnre.pe.gov.br">
                                <ambiente>2</ambiente>
                                <numeroRecibo>${numeroRecibo}</numeroRecibo>
                            </TConsultaLote_GNRE>
                        </gnreDadosMsg>
                    </soapenv:Body>
                </soapenv:Envelope>`;

            

            const response = await axios.post(
                this.URL_CONSULTA,
                xmlConsulta,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        SOAPAction: 'processar'
                    },

                    httpsAgent: this.httpsAgent,

                    timeout: 60000
                }
            );

            const xmlResposta =
                response.data;

            console.log(xmlResposta);

            const jsonResposta =
                await xml2js.parseStringPromise(
                    xmlResposta,
                    {
                        explicitArray: false
                    }
                );

            return {

                success: true,

                xmlConsulta,

                xmlResposta,

                jsonResposta

            };

        } catch (error) {

            return {

                success: false,

                message:
                    error.message,

                erro:
                    error?.response?.data ||
                    error.message

            };

        }

    }

}

