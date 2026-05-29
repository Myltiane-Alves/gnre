import { Padrao } from './Padrao.mjs';

/**
 * Fábrica de objetos de estado — equivalente a Sped\Gnre\Sefaz\EstadoFactory.php
 *
 * Retorna o objeto de estado correto para a UF informada.
 * Se não houver implementação específica, usa o Padrao (comportamento padrão).
 *
 * Extensível: importe e registre novos estados via EstadoFactory.registrar().
 *
 * Uso:
 *   const factory = new EstadoFactory();
 *   const estado  = factory.create('MA');
 *   const refXml  = estado.getNodeReferencia(guia);
 */
export class EstadoFactory {
  static #estados = new Map();

  /**
   * Registra um estado personalizado.
   * @param {string} sigla  Sigla da UF, ex: 'MA'
   * @param {Padrao} classe Classe que estende Padrao
   */
  static registrar(sigla, classe) {
    EstadoFactory.#estados.set(sigla.toUpperCase(), classe);
  }

  /**
   * Cria e retorna o objeto de estado para a UF informada.
   * Usa Padrao como fallback se a UF não tiver implementação específica.
   * @param {string} sigla
   * @returns {Padrao}
   */
  create(sigla = '') {
    const Classe = EstadoFactory.#estados.get(String(sigla).toUpperCase());
    return Classe ? new Classe() : new Padrao();
  }
}
