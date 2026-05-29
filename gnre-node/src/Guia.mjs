/**
 * Modelo de uma guia GNRE — equivalente a Sped\Gnre\Sefaz\Guia.php
 *
 * Campos prefixados com "c" são os campos do XML da SEFAZ (v1.00).
 * O LoteV2 reutiliza os mesmos campos mas os mapeia para a estrutura v2.00.
 * Campos prefixados com "retorno" são preenchidos após a resposta da SEFAZ.
 */
export class Guia {
  constructor() {
    // ── Campos principais ──────────────────────────────────────────────────
    /** Sigla da UF favorecida, ex: 'MA', 'SP' */
    this.c01_UfFavorecida = null;

    /** Código da receita, ex: 100102 (DIFAL), 100120 (FCP), 100099 (ICMS-ST) */
    this.c02_receita = null;

    /** Detalhamento da receita (opcional) */
    this.c25_detalhamentoReceita = null;

    /** Produto (opcional) */
    this.c26_produto = null;

    /** Tipo de identificação do emitente: 1 = CNPJ, 2 = CPF */
    this.c27_tipoIdentificacaoEmitente = null;

    /** CNPJ ou CPF do emitente (somente dígitos) */
    this.c03_idContribuinteEmitente = null;

    /** Tipo do documento de origem, ex: 10 = NF-e */
    this.c28_tipoDocOrigem = null;

    /** Número do documento de origem (NF-e, chave, etc.) */
    this.c04_docOrigem = null;

    /** Valor principal (sem acréscimos) */
    this.c06_valorPrincipal = null;

    /** Valor total (com juros/acréscimos) */
    this.c10_valorTotal = null;

    /** Data de vencimento no formato AAAA-MM-DD */
    this.c14_dataVencimento = null;

    /** Convênio (opcional) */
    this.c15_convenio = null;

    /** Razão social do emitente */
    this.c16_razaoSocialEmitente = null;

    /** Inscrição estadual do emitente (opcional) */
    this.c17_inscricaoEstadualEmitente = null;

    /** Endereço do emitente */
    this.c18_enderecoEmitente = null;

    /** Código IBGE do município do emitente (5 dígitos para GNRE) */
    this.c19_municipioEmitente = null;

    /** Sigla da UF do endereço do emitente */
    this.c20_ufEnderecoEmitente = null;

    /** CEP do emitente (somente dígitos, opcional) */
    this.c21_cepEmitente = null;

    /** Telefone do emitente no formato DD99999999 (opcional) */
    this.c22_telefoneEmitente = null;

    /** Tipo de identificação do destinatário: 1 = CNPJ, 2 = CPF */
    this.c34_tipoIdentificacaoDestinatario = null;

    /** CNPJ ou CPF do destinatário (somente dígitos) */
    this.c35_idContribuinteDestinatario = null;

    /** Inscrição estadual do destinatário (opcional) */
    this.c36_inscricaoEstadualDestinatario = null;

    /** Razão social do destinatário */
    this.c37_razaoSocialDestinatario = null;

    /** Código IBGE do município do destinatário (5 dígitos, opcional) */
    this.c38_municipioDestinatario = null;

    /** Data de pagamento no formato AAAA-MM-DD */
    this.c33_dataPagamento = null;

    // ── Referência (período de apuração) ─────────────────────────────────
    /** Período de referência (1–5, ou null) */
    this.periodo = null;

    /** Mês de referência, ex: '05' */
    this.mes = null;

    /** Ano de referência, ex: 2026 */
    this.ano = null;

    /** Número de parcelas (1–999, opcional) */
    this.parcela = null;

    // ── Campos extras ─────────────────────────────────────────────────────
    /**
     * Campos extras no formato:
     * [ { campoExtra: { codigo, tipo, valor } }, ... ]
     * Para v2, use: [ { campoExtra: { codigo, valor } }, ... ]
     */
    this.c39_camposExtras = [];

    /** Identificador da guia (opcional) */
    this.c42_identificadorGuia = null;

    // ── Campos retornados pela SEFAZ ─────────────────────────────────────
    this.retornoInformacoesComplementares = null;
    this.retornoAtualizacaoMonetaria = null;
    this.retornoJuros = null;
    this.retornoMulta = null;
    this.retornoRepresentacaoNumerica = null;
    this.retornoCodigoDeBarras = null;
    this.retornoSituacaoGuia = null;
    this.retornoSequencialGuia = null;
    this.retornoErrosDeValidacaoCampo = null;
    this.retornoErrosDeValidacaoCodigo = null;
    this.retornoErrosDeValidacaoDescricao = null;
    this.retornoNumeroDeControle = null;
  }
}
