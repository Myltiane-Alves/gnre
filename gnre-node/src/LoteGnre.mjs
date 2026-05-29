/**
 * Classe base abstrata para lotes GNRE — equivalente a Sped\Gnre\Sefaz\LoteGnre.php
 */
export class LoteGnre {
  static EMITENTE_PESSOA_JURIDICA    = 1;
  static DESTINATARIO_PESSOA_JURIDICA = 1;

  #guias = [];

  /** Adiciona uma guia ao lote */
  addGuia(guia) {
    this.#guias.push(guia);
  }

  /** Retorna todas as guias do lote */
  getGuias() {
    return this.#guias;
  }

  /** Retorna uma guia específica pelo índice */
  getGuia(index) {
    return this.#guias[index];
  }

  /** Gera o XML completo (envelope SOAP + dados do lote) */
  toXml() { throw new Error('Não implementado: toXml()'); }

  /** Retorna os headers HTTP para envio SOAP */
  getHeaderSoap() { throw new Error('Não implementado: getHeaderSoap()'); }

  /** Retorna a URL do webservice de envio */
  soapAction() { throw new Error('Não implementado: soapAction()'); }

  /** Envolve o XML do lote no envelope SOAP */
  getSoapEnvelop() { throw new Error('Não implementado: getSoapEnvelop()'); }

  /** Ativa/desativa o ambiente de testes */
  utilizarAmbienteDeTeste(ativo = false) { throw new Error('Não implementado: utilizarAmbienteDeTeste()'); }
}
