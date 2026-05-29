import { escapeXml } from './utils.mjs';

/**
 * Consulta de resultado de lote — equivalente a Sped\Gnre\Sefaz\Consulta.php
 *
 * Gera o envelope SOAP para consultar o resultado de um lote enviado à SEFAZ
 * usando o número de recibo retornado no envio.
 *
 * Uso:
 *   const consulta = new Consulta();
 *   consulta.setRecibo(1406670518);
 *   consulta.setEnvironment(2); // 1=producao, 2=homologacao
 *   const xml = consulta.toXml();
 *   const resp = await connection.doRequest(consulta.soapAction());
 */
export class Consulta {
  #recibo      = null;
  #environment = 2;
  #ambienteDeTeste = false;

  setRecibo(recibo) { this.#recibo = recibo; }
  getRecibo() { return this.#recibo; }

  setEnvironment(env) { this.#environment = env; }
  getEnvironment() { return this.#environment; }

  utilizarAmbienteDeTeste(ativo = false) {
    this.#ambienteDeTeste = ativo;
  }

  getHeaderSoap() {
    const action = this.#ambienteDeTeste
      ? 'http://www.testegnre.pe.gov.br/webservice/GnreResultadoLote'
      : 'http://www.gnre.pe.gov.br/webservice/GnreResultadoLote';

    return [
      `Content-Type: application/soap+xml;charset=utf-8;action="${action}"`,
      'SOAPAction: consultar',
    ];
  }

  soapAction() {
    return this.#ambienteDeTeste
      ? 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreResultadoLote'
      : 'https://www.gnre.pe.gov.br/gnreWS/services/GnreResultadoLote';
  }

  toXml() {
    const nsAction = this.#ambienteDeTeste
      ? 'http://www.testegnre.pe.gov.br/webservice/GnreResultadoLote'
      : 'http://www.gnre.pe.gov.br/webservice/GnreResultadoLote';

    const dadosXml = `<TConsLote_GNRE xmlns="http://www.gnre.pe.gov.br">\
<ambiente>${escapeXml(this.#environment)}</ambiente>\
<numeroRecibo>${escapeXml(String(this.#recibo ?? '').replace(/\D/g, ''))}</numeroRecibo>\
</TConsLote_GNRE>`;

    return `<?xml version="1.0" encoding="UTF-8"?>\
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">\
<soap12:Header>\
<gnreCabecMsg xmlns="http://www.gnre.pe.gov.br/wsdl/consultar"><versaoDados>1.00</versaoDados></gnreCabecMsg>\
</soap12:Header>\
<soap12:Body>\
<gnreDadosMsg xmlns="${nsAction}">${dadosXml}</gnreDadosMsg>\
</soap12:Body>\
</soap12:Envelope>`;
  }
}
