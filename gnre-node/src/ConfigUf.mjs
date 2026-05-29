import { escapeXml } from './utils.mjs';

/**
 * Consulta de configuração de UF — equivalente a Sped\Gnre\Sefaz\ConfigUf.php
 *
 * Permite consultar os municípios, receitas e outras configurações disponíveis
 * para uma determinada UF no portal GNRE.
 *
 * Uso:
 *   const cfg = new ConfigUf();
 *   cfg.setEstado('MA');
 *   cfg.setReceita('100102');
 *   cfg.setEnvironment(2);
 *   const xml = cfg.toXml();
 *   const resp = await connection.doRequest(cfg.soapAction());
 */
export class ConfigUf {
  #estado      = null;
  #receita     = null;
  #environment = 2;
  #ambienteDeTeste = false;

  setEstado(uf) { this.#estado = uf; }
  getEstado() { return this.#estado; }

  setReceita(receita) { this.#receita = receita; }
  getReceita() { return this.#receita; }

  setEnvironment(env) { this.#environment = env; }
  getEnvironment() { return this.#environment; }

  utilizarAmbienteDeTeste(ativo = false) {
    this.#ambienteDeTeste = ativo;
  }

  getHeaderSoap() {
    const action = this.#ambienteDeTeste
      ? 'http://www.testegnre.pe.gov.br/webservice/GnreConfigUF'
      : 'http://www.gnre.pe.gov.br/webservice/GnreConfigUF';

    return [
      `Content-Type: application/soap+xml;charset=utf-8;action="${action}"`,
      'SOAPAction: consultar',
    ];
  }

  soapAction() {
    return this.#ambienteDeTeste
      ? 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreConfigUF'
      : 'https://www.gnre.pe.gov.br/gnreWS/services/GnreConfigUF';
  }

  toXml() {
    const dadosXml = `<TConsultaConfigUf xmlns="http://www.gnre.pe.gov.br">\
<ambiente>${escapeXml(this.#environment)}</ambiente>\
<uf>${escapeXml(this.#estado)}</uf>\
<receita>${escapeXml(this.#receita)}</receita>\
</TConsultaConfigUf>`;

    return `<?xml version="1.0" encoding="UTF-8"?>\
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:gnr="http://www.gnre.pe.gov.br/webservice/GnreConfigUF">\
<soap12:Header>\
<gnr:gnreCabecMsg><gnr:versaoDados>1.00</gnr:versaoDados></gnr:gnreCabecMsg>\
</soap12:Header>\
<soap12:Body>\
<gnr:gnreDadosMsg>${dadosXml}</gnr:gnreDadosMsg>\
</soap12:Body>\
</soap12:Envelope>`;
  }
}
