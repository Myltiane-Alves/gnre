/**
 * =============================================================================
 * GERADOR DE GNRE - NODE.JS
 * =============================================================================
 *
 * Arquitetura recomendada:
 *
 * 1. ValidacaoGNRE
 * 2. ConfiguracaoUF
 * 3. CalculoGNRE
 * 4. EstruturaGNRE
 * 5. XMLGNRE
 *
 * =============================================================================
 */

import Decimal from 'decimal.js';
import { create } from 'xmlbuilder2';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

/**
 * =============================================================================
 * CONFIGURAÇÕES POR UF
 * =============================================================================
 */

const CONFIG_UF = {
  BA: {
    aliquotaInterna: 20,
    aliquotaInterestadual: 7,
    fcp: 2,
    receita: '100102',
    exigeGNRE: true
  },

  RJ: {
    aliquotaInterna: 22,
    aliquotaInterestadual: 12,
    fcp: 2,
    receita: '100099',
    exigeGNRE: true
  },

  MG: {
    aliquotaInterna: 18,
    aliquotaInterestadual: 12,
    fcp: 2,
    receita: '100129',
    exigeGNRE: true
  }
};

/**
 * =============================================================================
 * LOGGER
 * =============================================================================
 */

class FiscalLogger {
  constructor() {
    this.logs = [];
  }

  log(tipo, mensagem, dados = null) {
    const entry = {
      data: new Date().toISOString(),
      tipo,
      mensagem,
      dados
    };

    this.logs.push(entry);

    console.log(
      `[${tipo}] ${mensagem}`,
      dados ? JSON.stringify(dados, null, 2) : ''
    );
  }
}

/**
 * =============================================================================
 * VALIDAÇÃO GNRE
 * =============================================================================
 */

class ValidacaoGNRE {

  static validarNFe(nfe) {

    if (!nfe) {
      throw new Error('NF-e não informada');
    }

    if (!nfe.emit) {
      throw new Error('Emitente não encontrado');
    }

    if (!nfe.dest) {
      throw new Error('Destinatário não encontrado');
    }

    if (!nfe.total) {
      throw new Error('Totais não encontrados');
    }

    return true;
  }

  static precisaGNRE(nfe) {

    const ufOrigem = nfe.emit.UF;
    const ufDestino = nfe.dest.UF;

    const interestadual = ufOrigem !== ufDestino;

    const consumidorFinal = nfe.ide.indFinal === '1';

    const naoContribuinte = nfe.dest.indIEDest === '9';

    return (
      interestadual &&
      consumidorFinal &&
      naoContribuinte
    );
  }

  static validarUF(uf) {

    const config = CONFIG_UF[uf];

    if (!config) {
      throw new Error(`UF ${uf} não configurada`);
    }

    if (!config.exigeGNRE) {
      throw new Error(`UF ${uf} não exige GNRE`);
    }

    return true;
  }
}

/**
 * =============================================================================
 * CÁLCULO GNRE
 * =============================================================================
 */

class CalculoGNRE {

  constructor(logger) {
    this.logger = logger;
  }

  calcular(nfe) {

    const ufDestino = nfe.dest.UF;

    const config = CONFIG_UF[ufDestino];

    const valorProdutos = new Decimal(
      nfe.total.ICMSTot.vNF || 0
    );

    const aliquotaInterna = new Decimal(
      config.aliquotaInterna
    );

    const aliquotaInterestadual = new Decimal(
      config.aliquotaInterestadual
    );

    const aliquotaFCP = new Decimal(
      config.fcp
    );

    /**
     * DIFAL
     */

    const icmsDestino = valorProdutos
      .times(aliquotaInterna)
      .dividedBy(100);

    const icmsInterestadual = valorProdutos
      .times(aliquotaInterestadual)
      .dividedBy(100);

    const valorDifal = icmsDestino
      .minus(icmsInterestadual)
      .toDecimalPlaces(2);

    /**
     * FCP
     */

    const valorFCP = valorProdutos
      .times(aliquotaFCP)
      .dividedBy(100)
      .toDecimalPlaces(2);

    /**
     * TOTAL GNRE
     */

    const valorGNRE = valorDifal
      .plus(valorFCP)
      .toDecimalPlaces(2);

    const resultado = {
      baseCalculo: valorProdutos.toNumber(),
      aliquotaInterna: aliquotaInterna.toNumber(),
      aliquotaInterestadual: aliquotaInterestadual.toNumber(),
      aliquotaFCP: aliquotaFCP.toNumber(),
      valorDifal: valorDifal.toNumber(),
      valorFCP: valorFCP.toNumber(),
      valorGNRE: valorGNRE.toNumber(),
      receita: config.receita
    };

    this.logger.log(
      'CALCULO_GNRE',
      'GNRE calculada com sucesso',
      resultado
    );

    return resultado;
  }
}

/**
 * =============================================================================
 * ESTRUTURA GNRE
 * =============================================================================
 */

class EstruturaGNRE {

  static montar(nfe, calculo) {

    const dataVencimento = new Date();

    dataVencimento.setDate(
      dataVencimento.getDate() + 7
    );

    return {

      TLote_GNRE: {

        guias: {

          TDadosGNRE: {

            ufFavorecida: nfe.dest.UF,

            receita: calculo.receita,

            tipoDocOrigem: '10',

            docOrigem: nfe.ide.nNF,

            convenio: '0',

            referencia: new Date()
              .toISOString()
              .slice(0, 7),

            dataVencimento: dataVencimento
              .toISOString()
              .slice(0, 10),

            valorPrincipal: calculo.valorGNRE,

            valorTotal: calculo.valorGNRE,

            tipoIdentificacaoEmitente: '1',

            identificacaoEmitente: nfe.emit.CNPJ,

            razaoSocialEmitente: nfe.emit.xNome,

            enderecoEmitente: nfe.emit.enderEmit.xLgr,

            municipioEmitente: nfe.emit.enderEmit.xMun,

            ufEmitente: nfe.emit.enderEmit.UF,

            cepEmitente: nfe.emit.enderEmit.CEP,

            telefoneEmitente:
              nfe.emit.enderEmit.fone || '',

            tipoIdentificacaoDestinatario: '1',

            identificacaoDestinatario:
              nfe.dest.CPF || nfe.dest.CNPJ,

            municipioDestinatario:
              nfe.dest.enderDest.xMun,

            produto: '33',

            camposExtras: {

              campoExtra: [
                {
                  codigo: '10',
                  valor: nfe.chave
                }
              ]
            }
          }
        }
      }
    };
  }
}

/**
 * =============================================================================
 * XML GNRE
 * =============================================================================
 */

class XMLGNRE {

  static gerar(estrutura) {

    const doc = create({
      version: '1.0',
      encoding: 'UTF-8'
    }).ele(estrutura);

    return doc.end({
      prettyPrint: true
    });
  }

  static salvar(xml, caminho) {

    const diretorio = path.dirname(caminho);
    fs.mkdirSync(diretorio, { recursive: true });

    fs.writeFileSync(caminho, xml);

    return caminho;
  }
}

class PDFGNRE {

  static formatarCnpjCpf(valor) {
    const digits = String(valor || '').replace(/\D/g, '');

    if (digits.length === 14) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    }

    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }

    return digits;
  }

  static formatarDocumento(valor) {
    return String(valor || '').replace(/\D/g, '');
  }

  static formatarTelefone(valor) {
    const digits = String(valor || '').replace(/\D/g, '');

    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return digits;
  }

  static formatarCep(valor) {
    const digits = String(valor || '').replace(/\D/g, '');

    if (digits.length !== 8) {
      return digits;
    }

    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  static formatarReferencia(valor) {
    const texto = String(valor || '');

    if (/^\d{4}-\d{2}$/.test(texto)) {
      return `${texto.slice(5, 7)}/${texto.slice(0, 4)}`;
    }

    return texto;
  }

  static gerarNumeroControle({ nfe, calculo, dadosGNRE }) {
    const base = [
      nfe?.ide?.nNF,
      dadosGNRE?.receita,
      Math.round(Number(calculo?.valorGNRE || 0) * 100)
    ].join('');

    return String(base || '0').replace(/\D/g, '').slice(0, 12).padStart(12, '0');
  }

  static gerarLinhaDigitavel({ nfe, calculo, dadosGNRE }) {
    const numeros = [
      dadosGNRE?.ufFavorecida || '',
      dadosGNRE?.receita || '',
      nfe?.ide?.nNF || '',
      Math.round(Number(calculo?.valorGNRE || 0) * 100),
      String(nfe?.chave || '').slice(-12)
    ].join('').replace(/\D/g, '').padEnd(48, '0').slice(0, 48);

    return numeros.match(/.{1,12}/g)?.join('  ') || numeros;
  }

  static desenharCampo(doc, {
    x,
    y,
    w,
    h,
    label,
    value = '',
    align = 'left',
    bold = false,
    fontSize = 8,
    valueFontSize = 9,
    labelAlign = 'left',
    labelBold = false,
    paddingX = 3,
    labelOffsetY = 2,
    valueOffsetY = 13
  }) {
    doc.rect(x, y, w, h).stroke();
    doc.font(labelBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).text(label, x + paddingX, y + labelOffsetY, {
      width: w - (paddingX * 2),
      align: labelAlign
    });
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(valueFontSize).text(String(value || ''), x + paddingX, y + valueOffsetY, {
      width: w - (paddingX * 2),
      align,
      ellipsis: true
    });
  }

  static desenharSecao(doc, { x, y, w, h, titulo }) {
    doc.rect(x, y, w, h).stroke();
    doc.font('Helvetica').fontSize(8).text(titulo, x, y + 2, {
      width: w,
      align: 'center'
    });
  }

  static desenharCodigoBarras(doc, { x, y, w, h, digits }) {
    const numeros = String(digits || '').replace(/\D/g, '');
    const barras = numeros.split('').flatMap((digit) => {
      const valor = Number(digit);
      return [
        1,
        (valor % 3) + 1,
        1,
        ((valor + 1) % 3) + 1
      ];
    });

    const totalUnidades = barras.reduce((acc, current) => acc + current, 0) || 1;
    const unidade = w / totalUnidades;
    let cursorX = x;

    doc.save();
    doc.rect(x, y, w, h).stroke();

    barras.forEach((largura, index) => {
      const barWidth = unidade * largura;

      if (index % 2 === 0) {
        doc.rect(cursorX, y, Math.max(barWidth, 0.8), h).fill('black');
      }

      cursorX += barWidth;
    });

    doc.restore();
  }

  static desenharVia(doc, { x, y, width, height, tituloVia, nfe, calculo, dadosGNRE, numeroControle, linhaDigitavel }) {
    const authWidth = 10;
    const sideWidth = 172;
    const mainWidth = width - sideWidth - authWidth;
    const titleHeight = 22;
    const emitHeight = 74;
    const destHeight = 44;
    const fiscalHeight = 56;
    const validHeight = 18;
    const lineHeight = 16;
    const fixedHeights = titleHeight + emitHeight + destHeight + fiscalHeight + validHeight + lineHeight;
    const barcodeHeight = Math.max(30, height - fixedHeights);
    const sideRows = [24, 30, 30, 26, 24, 24, 24, 24, 24];
    const rightX = x + mainWidth;
    const authX = rightX + sideWidth;
    const municipioEmitente = nfe?.emit?.enderEmit?.xMun || '';
    const ufEmitente = nfe?.emit?.enderEmit?.UF || nfe?.emit?.UF || '';
    const telefoneEmitente = PDFGNRE.formatarTelefone(nfe?.emit?.enderEmit?.fone || '');
    const telefoneEmitenteLayout = (() => {
      const digits = String(telefoneEmitente || '').replace(/\D/g, '');
      if (digits.length <= 2) return digits;
      return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    })();
    const documentoDestinatario = PDFGNRE.formatarDocumento(nfe?.dest?.CPF || nfe?.dest?.CNPJ || '');
    const referencia = PDFGNRE.formatarReferencia(dadosGNRE?.referencia);
    const valorPrincipal = PDFGNRE.formatarMoeda(dadosGNRE?.valorPrincipal || calculo?.valorGNRE);
    const valorTotal = PDFGNRE.formatarMoeda(dadosGNRE?.valorTotal || calculo?.valorGNRE);
    const dataVencimento = PDFGNRE.formatarData(dadosGNRE?.dataVencimento);
    const infoComplementar = `Chave NF-e: ${nfe?.chave || ''}`;

    doc.rect(x, y, width, height).stroke();
    if (authWidth > 0) {
      doc.rect(authX, y, authWidth, height).stroke();
      doc.font('Helvetica-Bold').fontSize(7).rotate(-90, { origin: [authX + authWidth / 2, y + height / 2] });
      doc.text('Autenticação', authX - height + 8, y + height - 13, {
        width: height - 16,
        align: 'center'
      });
      doc.rotate(90, { origin: [authX + authWidth / 2, y + height / 2] });
    }
    doc.font('Helvetica');

    PDFGNRE.desenharCampo(doc, {
      x,
      y,
      w: mainWidth,
      h: titleHeight,
      label: 'Guia Nacional de Recolhimento de Tributos Estaduais - GNRE',
      value: '',
      fontSize: 7,
      valueFontSize: 1,
      labelAlign: 'center',
      labelBold: true
    });

    PDFGNRE.desenharCampo(doc, {
      x: rightX,
      y,
      w: sideWidth / 2,
      h: titleHeight,
      label: 'UF Favorecida',
      value: dadosGNRE?.ufFavorecida || '',
      align: 'center',
      bold: true,
      paddingX: 1
    });

    PDFGNRE.desenharCampo(doc, {
      x: rightX + sideWidth / 2,
      y,
      w: sideWidth / 2,
      h: titleHeight,
      label: 'Código da Receita',
      value: dadosGNRE?.receita || '',
      align: 'center',
      bold: true,
      paddingX: 1
    });

    const emitY = y + titleHeight;
    PDFGNRE.desenharSecao(doc, {
      x,
      y: emitY,
      w: mainWidth,
      h: emitHeight,
      titulo: 'Dados do Emitente'
    });
    doc.font('Helvetica').fontSize(7);
    const leftLabelX = x + 4;
    const leftValueX = x + 56;
    const leftValueW = mainWidth * 0.56;
    const rightColX = x + mainWidth * 0.68;
    const rightColW = (x + mainWidth - 6) - rightColX;
    const rowStartY = emitY + 16;
    const rowGap = 12;

    doc.font('Helvetica-Bold').text('Razão Social:', leftLabelX, rowStartY);
    doc.font('Helvetica');
    doc.text(nfe?.emit?.xNome || '', leftLabelX, rowStartY + 8, { width: leftValueW + 52, ellipsis: true });

    doc.font('Helvetica-Bold').fontSize(8).text('Endereço:', leftLabelX, rowStartY + rowGap * 2);
    doc.font('Helvetica').fontSize(7);
    doc.text(nfe?.emit?.enderEmit?.xLgr || '', leftValueX, rowStartY + rowGap * 2, { width: leftValueW, ellipsis: true });

    doc.font('Helvetica-Bold').fontSize(8).text('Município:', leftLabelX, rowStartY + rowGap * 3);
    doc.font('Helvetica').fontSize(7);
    doc.text(municipioEmitente, leftValueX, rowStartY + rowGap * 3, { width: leftValueW, ellipsis: true });

    doc.font('Helvetica-Bold').fontSize(8).text('CEP:', leftLabelX, rowStartY + rowGap * 4);
    doc.font('Helvetica').fontSize(7);
    doc.text(PDFGNRE.formatarCep(nfe?.emit?.enderEmit?.CEP || ''), leftValueX, rowStartY + rowGap * 4, { width: leftValueW, ellipsis: true });

    doc.font('Helvetica-Bold').text('CNPJ/CPF/Insc. Est.:', rightColX, rowStartY, { width: rightColW, ellipsis: true });
    doc.font('Helvetica').text(PDFGNRE.formatarCnpjCpf(nfe?.emit?.CNPJ || nfe?.emit?.CPF || ''), rightColX, rowStartY + 8, { width: rightColW, align: 'left', ellipsis: true });

    doc.font('Helvetica').text(`UF: ${ufEmitente}`, rightColX, rowStartY + rowGap * 2, { width: rightColW, align: 'left', ellipsis: true });

    doc.font('Helvetica').text(`Telefone: ${telefoneEmitenteLayout}`, rightColX, rowStartY + rowGap * 3, { width: rightColW, align: 'left', ellipsis: true });

    let cursorSideY = y + titleHeight;
    [
      ['Nº de Controle', numeroControle],
      ['Data de Vencimento', dataVencimento],
      ['Nº do Documento de Origem', dadosGNRE?.docOrigem || ''],
      ['Período de Referência', referencia],
      ['Valor Principal', valorPrincipal],
      ['Atualização Monetária', PDFGNRE.formatarMoeda(0)],
      ['Juros', PDFGNRE.formatarMoeda(0)],
      ['Multa', PDFGNRE.formatarMoeda(0)],
      ['Total a Recolher', valorTotal]
    ].forEach(([label, value], index) => {
      const rowHeight = sideRows[index];

      if (label === 'Período de Referência') {
        const periodoWidth = Math.floor(sideWidth * 0.68);
        const parcelaWidth = sideWidth - periodoWidth;

        PDFGNRE.desenharCampo(doc, {
          x: rightX,
          y: cursorSideY,
          w: periodoWidth,
          h: rowHeight,
          label,
          value,
          align: 'center',
          paddingX: 1
        });
        PDFGNRE.desenharCampo(doc, {
          x: rightX + periodoWidth,
          y: cursorSideY,
          w: parcelaWidth,
          h: rowHeight,
          label: 'Nº Parcela',
          value: '1/1',
          align: 'center',
          paddingX: 1
        });
      } else {
        PDFGNRE.desenharCampo(doc, {
          x: rightX,
          y: cursorSideY,
          w: sideWidth,
          h: rowHeight,
          label,
          value,
          align: label.includes('Valor') || label === 'Juros' || label === 'Multa' || label === 'Total a Recolher' ? 'right' : 'center',
          bold: label === 'Total a Recolher',
          paddingX: 1
        });
      }

      cursorSideY += rowHeight;
    });

    const destY = emitY + emitHeight;
    PDFGNRE.desenharSecao(doc, {
      x,
      y: destY,
      w: mainWidth,
      h: destHeight,
      titulo: 'Dados do Destinatário'
    });
    doc.font('Helvetica').fontSize(6);
    doc.text('CNPJ/CPF/Insc. Est.:', x + 4, destY + 16);
    doc.text(documentoDestinatario, x + 110, destY + 16, { width: mainWidth - 116, ellipsis: true });
    doc.text('Município:', x + 4, destY + 28);
    doc.text(nfe?.dest?.enderDest?.xMun || dadosGNRE?.municipioDestinatario || '', x + 60, destY + 28, { width: 170, ellipsis: true });

    const fiscalY = destY + destHeight;
    PDFGNRE.desenharSecao(doc, {
      x,
      y: fiscalY,
      w: mainWidth,
      h: fiscalHeight,
      titulo: 'Informações à Fiscalização'
    });
    doc.font('Helvetica').fontSize(6);
    doc.text('Convênio / Protocolo:', x + 4, fiscalY + 16);
    doc.text(dadosGNRE?.convenio || '0', x + 95, fiscalY + 16, { width: mainWidth - 100, ellipsis: true });
    doc.text('Produto:', x + 4, fiscalY + 29);
    doc.text(dadosGNRE?.produto || '', x + 55, fiscalY + 29, { width: mainWidth - 60, ellipsis: true });
    doc.text('Informações Complementares', x + 4, fiscalY + 42);
    doc.text(infoComplementar, x + 120, fiscalY + 42, { width: mainWidth - 125, ellipsis: true });

    const validY = fiscalY + fiscalHeight;
    doc.rect(x, validY, mainWidth, validHeight).stroke();
    doc.font('Helvetica').fontSize(8).text(
      `Documento válido para pagamento até ${dataVencimento}`,
      x + 4,
      validY + 5,
      { width: mainWidth - 8 }
    );

    const lineY = validY + validHeight;
    doc.rect(x, lineY, mainWidth, lineHeight).stroke();
    doc.font('Helvetica').fontSize(8).text(linhaDigitavel, x + 4, lineY + 4, {
      width: mainWidth - 8,
      align: 'center'
    });

    const barcodeY = lineY + lineHeight;
    PDFGNRE.desenharCodigoBarras(doc, {
      x: x + 16,
      y: barcodeY + 5,
      w: mainWidth - 140,
      h: barcodeHeight - 8,
      digits: linhaDigitavel
    });

    doc.font('Helvetica-Bold').fontSize(10).text(tituloVia, x + mainWidth - 120, barcodeY + 5, {
      width: 110,
      align: 'right'
    });
  }

  static formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(valor || 0));
  }

  static formatarData(data) {
    const valor = new Date(data);

    if (Number.isNaN(valor.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('pt-BR').format(valor);
  }

  static gerarBuffer({ nfe, calculo, estrutura }) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 18, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const dadosGNRE = estrutura?.TLote_GNRE?.guias?.TDadosGNRE || {};

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
      const topStart = 26;
      const gapBetweenSections = 8;
      const availableHeight = pageHeight - topStart - (gapBetweenSections * 2);
      const sectionHeight = Math.floor(availableHeight / 3);
      const numeroControle = PDFGNRE.gerarNumeroControle({ nfe, calculo, dadosGNRE });
      const linhaDigitavel = PDFGNRE.gerarLinhaDigitavel({ nfe, calculo, dadosGNRE });

      doc.font('Helvetica-Bold').fontSize(15).text('ANEXO I', doc.page.margins.left, 10, {
        width: pageWidth,
        align: 'center'
      });

      [
        { tituloVia: '1ª via Banco' },
        { tituloVia: '2ª via Contribuinte' },
        { tituloVia: '3ª via Contribuinte/Fisco' }
      ].forEach((via, index) => {
        const viaY = topStart + ((sectionHeight + gapBetweenSections) * index);

        PDFGNRE.desenharVia(doc, {
          x: doc.page.margins.left,
          y: viaY,
          width: pageWidth,
          height: sectionHeight,
          tituloVia: via.tituloVia,
          nfe,
          calculo,
          dadosGNRE,
          numeroControle,
          linhaDigitavel
        });

        if (index < 2) {
          const separatorY = viaY + sectionHeight + (gapBetweenSections / 2);
          doc.save();
          doc.dash(2, { space: 2 });
          doc.moveTo(doc.page.margins.left, separatorY).lineTo(doc.page.width - doc.page.margins.right, separatorY).stroke();
          doc.undash();
          doc.restore();
        }
      });

      doc.end();
    });
  }

  static salvar(buffer, caminho) {
    const diretorio = path.dirname(caminho);
    fs.mkdirSync(diretorio, { recursive: true });
    fs.writeFileSync(caminho, buffer);
    return caminho;
  }
}

/**
 * =============================================================================
 * GERADOR PRINCIPAL GNRE
 * =============================================================================
 */

class GeradorGNRE {

  constructor() {
    this.logger = new FiscalLogger();
  }

  async gerar(nfe, options = {}) {

    const {
      salvarArquivo = true,
      pastaSaida = './gnre'
    } = options;

    try {

      this.logger.log(
        'INICIO',
        'Iniciando geração GNRE'
      );

      /**
       * 1. VALIDAR NF-E
       */

      ValidacaoGNRE.validarNFe(nfe);

      /**
       * 2. VERIFICAR NECESSIDADE GNRE
       */

      const precisaGNRE =
        ValidacaoGNRE.precisaGNRE(nfe);

      if (!precisaGNRE) {

        this.logger.log(
          'GNRE',
          'Operação não necessita GNRE'
        );

        return {
          success: false,
          message: 'Operação não necessita GNRE'
        };
      }

      /**
       * 3. VALIDAR UF
       */

      ValidacaoGNRE.validarUF(
        nfe.dest.UF
      );

      /**
       * 4. CALCULAR GNRE
       */

      const calculo = new CalculoGNRE(
        this.logger
      ).calcular(nfe);

      /**
       * 5. MONTAR ESTRUTURA
       */

      const estrutura =
        EstruturaGNRE.montar(
          nfe,
          calculo
        );

      /**
       * 6. GERAR XML
       */

      const xml = XMLGNRE.gerar(
        estrutura
      );

      /**
       * 7. SALVAR XML
       */

      const nomeArquivo =
        `GNRE_${nfe.ide.nNF}.xml`;

      let caminhoArquivo = null;
      if (salvarArquivo) {
        caminhoArquivo = XMLGNRE.salvar(
          xml,
          path.join(pastaSaida, nomeArquivo)
        );
      }

      /**
       * SUCESSO
       */

      this.logger.log(
        'SUCESSO',
        'GNRE gerada com sucesso'
      );

      return {
        success: true,
        calculo,
        estrutura,
        xml,
        arquivo: nomeArquivo,
        caminhoArquivo,
        logs: this.logger.logs
      };

    } catch (error) {

      this.logger.log(
        'ERRO',
        error.message,
        {
          stack: error.stack
        }
      );

      throw error;
    }
  }
}

/**
 * =============================================================================
 * EXEMPLO DE USO
 * =============================================================================
 */

async function exemplo() {

  const nfe = {

    chave:
      '35260512345678000123550010000012341000012345',

    ide: {
      nNF: '1234',
      indFinal: '1'
    },

    emit: {
      CNPJ: '12345678000123',
      xNome: 'EMPRESA TESTE',
      UF: 'SP',

      enderEmit: {
        xLgr: 'RUA TESTE',
        xMun: 'SAO PAULO',
        UF: 'SP',
        CEP: '01000000',
        fone: '11999999999'
      }
    },

    dest: {
      UF: 'BA',
      indIEDest: '9',

      CPF: '12345678909',

      enderDest: {
        xMun: 'SALVADOR'
      }
    },

    total: {
      ICMSTot: {
        vNF: 1000
      }
    }
  };

  const gerador = new GeradorGNRE();

  const resultado =
    await gerador.gerar(nfe);

  console.log(resultado.xml);
}

/**
 * =============================================================================
 * EXPORTS
 * =============================================================================
 */

export {
  GeradorGNRE,
  CalculoGNRE,
  ValidacaoGNRE,
  EstruturaGNRE,
  XMLGNRE,
  PDFGNRE
};

// exemplo();