import https from 'https';
import fs   from 'fs';

/**
 * Conexão com o webservice da SEFAZ — equivalente a Sped\Gnre\Webservice\Connection.php
 *
 * Realiza requisições HTTPS autenticadas com certificado digital (PFX ou PEM).
 *
 * Uso com PFX:
 *   const setup = new MinhaConfiguracao();          // extends Setup
 *   const conn  = new Connection(setup, lote.getHeaderSoap(), lote.toXml());
 *   const resp  = await conn.doRequest(lote.soapAction());
 *
 * Uso com PFX Buffer direto (sem Setup):
 *   const conn = Connection.comPfx(pfxBuffer, 'senha', headers, xml);
 *   const resp = await conn.doRequest(url);
 */
export class Connection {
  #setup   = null;
  #headers = [];
  #data    = '';
  #options = {};

  constructor(setup, headers, data) {
    this.#setup   = setup;
    this.#headers = Array.isArray(headers) ? headers : [headers];
    this.#data    = data;

    // opções base — substituídas se o setup fornecer PFX ou PEM
    this.#options = {
      rejectUnauthorized: false,
    };

    if (setup) this.#aplicarCertificado(setup);
  }

  // ── Factory: certificado PFX direto (Buffer) ─────────────────────────────

  static comPfx(pfxBuffer, senha, headers, data) {
    const conn = new Connection(null, headers, data);
    conn.#options.pfx       = pfxBuffer;
    conn.#options.passphrase = senha;
    return conn;
  }

  // ── Factory: certificado PEM (cert + key por caminho) ────────────────────

  static comPem(certPath, keyPath, headers, data) {
    const conn = new Connection(null, headers, data);
    conn.#options.cert = fs.readFileSync(certPath);
    conn.#options.key  = fs.readFileSync(keyPath);
    return conn;
  }

  // ── Sobrescreve ou adiciona opções de conexão (equivalente a addCurlOption) ─

  addOption(extraOptions = {}) {
    Object.assign(this.#options, extraOptions);
    return this;
  }

  getOptions() { return { ...this.#options }; }

  // ── Envia a requisição e retorna o XML da resposta ────────────────────────

  doRequest(url) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const body      = Buffer.from(this.#data, 'utf-8');

      // Converte array de strings 'Header: valor' para objeto
      const headersObj = this.#parseHeaders(this.#headers);
      headersObj['Content-Length'] = body.length;

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port:     parsedUrl.port || 443,
        path:     parsedUrl.pathname + (parsedUrl.search || ''),
        method:   'POST',
        headers:  headersObj,
        ...this.#options,
      };

      if (this.#setup?.getDebug?.()) {
        console.log('[Connection] Enviando para:', url);
        console.log('[Connection] Headers:', headersObj);
        console.log('[Connection] Body:\n', this.#data);
      }

      const req = https.request(reqOptions, (res) => {
        const chunks = [];

        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const resposta = Buffer.concat(chunks).toString('utf-8');

          if (this.#setup?.getDebug?.()) {
            console.log('[Connection] Status:', res.statusCode);
            console.log('[Connection] Resposta:\n', resposta);
          }

          // Extrai só o XML (descarta cabeçalhos HTTP que eventualmente venham junto)
          const inicioXml = resposta.indexOf('<');
          const xml = inicioXml >= 0 ? resposta.slice(inicioXml) : resposta;

          resolve(xml || resposta);
        });
      });

      req.on('error', (err) => {
        if (this.#setup?.getDebug?.()) {
          console.error('[Connection] Erro:', err.message);
        }
        reject(err);
      });

      req.write(body);
      req.end();
    });
  }

  // ── Privado ──────────────────────────────────────────────────────────────

  #aplicarCertificado(setup) {
    const pfxBuffer = setup.getCertificatePfxBuffer?.();
    if (pfxBuffer) {
      this.#options.pfx        = pfxBuffer;
      this.#options.passphrase  = setup.getCertificatePassword?.() || '';
      return;
    }

    const pemFile = setup.getCertificatePemFile?.();
    const keyFile = setup.getPrivateKey?.();
    if (pemFile && keyFile) {
      this.#options.cert = fs.readFileSync(pemFile);
      this.#options.key  = fs.readFileSync(keyFile);
      return;
    }
  }

  #parseHeaders(arr) {
    const obj = {};
    for (const h of arr) {
      const idx = h.indexOf(':');
      if (idx > 0) {
        const key = h.slice(0, idx).trim();
        const val = h.slice(idx + 1).trim();
        obj[key]  = val;
      }
    }
    return obj;
  }
}
