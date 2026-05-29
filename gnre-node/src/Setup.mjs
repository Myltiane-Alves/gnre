/**
 * Classe base de configuração — equivalente a Sped\Gnre\Configuration\Setup.php
 * Estenda essa classe e implemente todos os métodos para configurar o certificado
 * e as opções de conexão com o webservice da SEFAZ.
 */
export class Setup {
  /** URL base do portal GNRE (não usado diretamente pelo Connection) */
  getBaseUrl() { throw new Error('Não implementado: getBaseUrl()'); }

  /** CNPJ do titular do certificado (somente dígitos) */
  getCertificateCnpj() { throw new Error('Não implementado: getCertificateCnpj()'); }

  /** Diretório onde o arquivo PEM do certificado está armazenado */
  getCertificateDirectory() { throw new Error('Não implementado: getCertificateDirectory()'); }

  /** Nome do arquivo PEM do certificado */
  getCertificateName() { throw new Error('Não implementado: getCertificateName()'); }

  /** Senha do certificado */
  getCertificatePassword() { throw new Error('Não implementado: getCertificatePassword()'); }

  /** Caminho completo para o arquivo PEM do certificado público */
  getCertificatePemFile() { throw new Error('Não implementado: getCertificatePemFile()'); }

  /**
   * Ambiente: 1 = produção, 2 = homologação
   * @returns {number}
   */
  getEnvironment() { throw new Error('Não implementado: getEnvironment()'); }

  /** Caminho completo para o arquivo PEM da chave privada */
  getPrivateKey() { throw new Error('Não implementado: getPrivateKey()'); }

  /** IP do proxy (vazio se não usar) */
  getProxyIp() { return ''; }

  /** Senha do proxy */
  getProxyPass() { return ''; }

  /** Porta do proxy (0 se não usar) */
  getProxyPort() { return 0; }

  /** Usuário do proxy */
  getProxyUser() { return ''; }

  /** Habilitar modo debug (exibe informações de requisição) */
  getDebug() { return false; }

  /**
   * Retorna o buffer do arquivo PFX (alternativa ao PEM).
   * Implemente este método quando usar certificado PFX em vez de PEM.
   * @returns {Buffer|null}
   */
  getCertificatePfxBuffer() { return null; }
}
