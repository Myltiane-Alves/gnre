import { escapeXml } from '../utils.mjs';

/**
 * Estado padrão — equivalente a Sped\Gnre\Sefaz\Estados\Padrao.php
 *
 * Contém a lógica padrão para gerar os nós XML de campos extras (c39)
 * e de referência (c05) de uma guia. Os estados específicos podem
 * sobrescrever esses métodos conforme suas regras próprias.
 */
export class Padrao {

  /**
   * Gera o XML do nó c39_camposExtras (formato v1.00).
   * Retorna null se não houver campos extras.
   * @param {Guia} guia
   * @returns {string|null}
   */
  getNodeCamposExtras(guia) {
    if (!Array.isArray(guia.c39_camposExtras) || guia.c39_camposExtras.length === 0) {
      return null;
    }

    let xml = '<c39_camposExtras>';
    for (const item of guia.c39_camposExtras) {
      const ce = item.campoExtra ?? item;
      xml += '<campoExtra>';
      xml += `<codigo>${escapeXml(ce.codigo)}</codigo>`;
      xml += `<tipo>${escapeXml(ce.tipo)}</tipo>`;
      xml += `<valor>${escapeXml(ce.valor)}</valor>`;
      xml += '</campoExtra>';
    }
    xml += '</c39_camposExtras>';
    return xml;
  }

  /**
   * Gera o XML do nó c05_referencia (periodo/mes/ano/parcela).
   * Retorna null se nenhum dos campos de referência estiver preenchido.
   * @param {Guia} guia
   * @returns {string|null}
   */
  getNodeReferencia(guia) {
    if (!guia.periodo && !guia.mes && !guia.ano && !guia.parcela) {
      return null;
    }

    let xml = '<c05_referencia>';
    if (guia.periodo) xml += `<periodo>${escapeXml(guia.periodo)}</periodo>`;
    if (guia.mes)     xml += `<mes>${escapeXml(guia.mes)}</mes>`;
    if (guia.ano)     xml += `<ano>${escapeXml(guia.ano)}</ano>`;
    if (guia.parcela) xml += `<parcela>${escapeXml(guia.parcela)}</parcela>`;
    xml += '</c05_referencia>';
    return xml;
  }
}
