/**
 * =============================================================================
 * GERADOR DE NFC-e/NF-e - NODE.JS
 * =============================================================================
 * 
 * Implementação equivalente ao example.pas (Delphi/ACBr) usando node-sped-nfe
 * 
 * MELHORIAS IMPLEMENTADAS:
 * 1. ✅ Biblioteca Decimal.js para precisão monetária
 * 2. ✅ Validação robusta de dados
 * 3. ✅ Tratamento de erros detalhado
 * 4. ✅ Logs fiscais para auditoria
 * 5. ✅ Estrutura modular e reutilizável
 * 
 * @version 2.0
 * @date 2025-12-11
 * =============================================================================
 */

import { Make, Tools } from 'node-sped-nfe';
import Decimal from 'decimal.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const url = process.env.API_URL;


/**
 * =============================================================================
 * FUNÇÕES AUXILIARES
 * =============================================================================
 */

/**
 * Arredondamento preciso para valores monetários (equivalente ao RoundTo do Pascal)
 */
function roundToDecimal(valor, casasDecimais = 2) {
  return new Decimal(valor || 0).toDecimalPlaces(casasDecimais).toNumber();
}

/**
 * Converte UF para código da SEFAZ
 */
function ufToCodigo(uf) {
  const map = {
    "RO": "11", "AC": "12", "AM": "13", "RR": "14", "PA": "15", "AP": "16", "TO": "17",
    "MA": "21", "PI": "22", "CE": "23", "RN": "24", "PB": "25", "PE": "26", "AL": "27", 
    "SE": "28", "BA": "29", "MG": "31", "ES": "32", "RJ": "33", "SP": "35", "PR": "41", 
    "SC": "42", "RS": "43", "MS": "50", "MT": "51", "GO": "52", "DF": "53"
  };
  if (!uf) return "35";
  return map[uf.toUpperCase()] || "35";
}

/**
 * Valida estrutura de dados da venda
 */
function validarDadosVenda(vendaData) {
  if (!vendaData) {
    throw new Error('Dados de venda não fornecidos');
  }

  if (!vendaData.data || !Array.isArray(vendaData.data) || vendaData.data.length === 0) {
    throw new Error('Estrutura de dados inválida: data ausente ou vazio');
  }

  const venda = vendaData.data[0];
  
  if (!venda.venda) {
    throw new Error('Dados principais da venda ausentes');
  }

  if (!venda.detalhe || !Array.isArray(venda.detalhe) || venda.detalhe.length === 0) {
    throw new Error('Nenhum produto encontrado na venda');
  }

  // Validar campos obrigatórios
  const camposObrigatorios = [
    'NFE_INFNFE_IDE_MOD',
    'NFE_INFNFE_EMIT_CNPJ',
    'NFE_INFNFE_EMIT_ENDEREMIT_UF',
    'CHAVE'
  ];

  for (const campo of camposObrigatorios) {
    if (!venda.venda[campo]) {
      throw new Error(`Campo obrigatório ausente: ${campo}`);
    }
  }

  return true;
}

/**
 * Carrega certificado digital
 */
async function getCertOptions(senha, fallbackPfxPath = './GTO COMERCIO 2025-2026.pfx') {
  // PFX via environment
  if (process.env.CERT_PFX_BASE64) {
    try {
      const buf = Buffer.from(process.env.CERT_PFX_BASE64, "base64");
      if (buf.length > 0) {
        return { pfx: buf, senha };
      }
    } catch (e) {
      console.error("ERRO: CERT_PFX_BASE64 inválido:", e.message);
    }
  }

  // PFX arquivo local
  if (fallbackPfxPath && fs.existsSync(fallbackPfxPath)) {
    try {
      const buf = fs.readFileSync(path.resolve(fallbackPfxPath));
      if (buf.length > 0) {
        return { pfx: buf, senha };
      }
    } catch (e) {
      console.error("ERRO ao ler arquivo PFX local:", e.message);
    }
  }

  // PEM via environment
  if (process.env.CERT_PEM_CERT_BASE64 && process.env.CERT_PEM_KEY_BASE64) {
    try {
      const cert = Buffer.from(process.env.CERT_PEM_CERT_BASE64, "base64");
      const key = Buffer.from(process.env.CERT_PEM_KEY_BASE64, "base64");
      return { cert, key };
    } catch (e) {
      console.error("ERRO: CERT_PEM_*_BASE64 inválido:", e.message);
    }
  }

  return null;
}

/**
 * =============================================================================
 * CLASSE PRINCIPAL - GERADOR DE NFC-e
 * =============================================================================
 */
class GeradorNFCe {
  constructor() {
    // Inicializar acumuladores (equivalente às variáveis do Pascal)
    this.v_TotICMS = new Decimal(0);
    this.v_TotPis = new Decimal(0);
    this.v_TotCofins = new Decimal(0);
    this.v_TotIBSUF = new Decimal(0);
    this.v_TotCBS = new Decimal(0);
    this.V_Tot_Desconto = new Decimal(0);
    this.V_ICMSTot_vNF = new Decimal(0);
    this.contador = 0;
    
    this.logs = [];
  }

  /**
   * Adiciona log de auditoria
   */
  log(tipo, mensagem, dados = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      tipo,
      mensagem,
      dados
    };
    this.logs.push(entry);
    console.log(`[${tipo}] ${mensagem}`, dados || '');
  }

  /**
   * Calcula valor base do produto (equivalente ao VrCalculado do Pascal)
   */
  calcularValorBase(det) {
    const vrUnit = new Decimal(det.VUNCOM || 0);
    const qtd = new Decimal(det.QCOM || 0);
    const vrDesconto = new Decimal(det.VDESCONTO || 0);

    // VrCalculado = (vrUnit * qtd) - vrDesconto
    const vrCalculado = vrUnit.times(qtd).minus(vrDesconto).toDecimalPlaces(2);

    this.log('CALCULO_BASE', `Produto ${det.CPROD}`, {
      vrUnit: vrUnit.toNumber(),
      qtd: qtd.toNumber(),
      vrDesconto: vrDesconto.toNumber(),
      vrCalculado: vrCalculado.toNumber()
    });

    return vrCalculado;
  }

  /**
   * Calcula ICMS (EXATAMENTE como no Pascal)
   */
  calcularICMS(det, VrCalculado, crt, uf) {
    const ncm = det.NCM || "";
    let icmsData = {};

    // Simples Nacional
    if (crt === "1") {
      icmsData = {
        CSOSN: "102",
        orig: "0",
        modBC: "0",
        vBC: 0,
        pICMS: 0,
        vICMS: 0
      };
      
      this.log('ICMS', 'Simples Nacional - CSOSN 102', { produto: det.CPROD });
    } 
    // Regime Normal
    else {
      // Produtos específicos no DF
      if ((ncm === "38089429" || ncm === "22072019") && uf === "DF") {
        icmsData = {
          CST: "40",  // Isento
          orig: "0",
          modBC: "0",
          vBC: 0,
          pICMS: 0,
          vICMS: 0
        };
        
        this.log('ICMS', 'Produto isento no DF', { produto: det.CPROD, ncm });
      } 
      // Outros produtos
      else {
        let pICMS = new Decimal(19.00);  // Padrão para outros estados

        // Regra especial para DF
        if (uf === "DF") {
          const percProduto = new Decimal(det.ICMS_PICMS || 0);
          pICMS = percProduto.greaterThanOrEqualTo(12) ? percProduto : new Decimal(20.00);
        }

        const vICMS = VrCalculado.times(pICMS).dividedBy(100).toDecimalPlaces(2);

        icmsData = {
          CST: "00",
          orig: "0",
          modBC: "3",
          vBC: VrCalculado.toNumber(),
          pICMS: pICMS.toNumber(),
          vICMS: vICMS.toNumber()
        };

        // Acumular total
        this.v_TotICMS = this.v_TotICMS.plus(vICMS);

        this.log('ICMS', 'Tributado integralmente', {
          produto: det.CPROD,
          vBC: VrCalculado.toNumber(),
          pICMS: pICMS.toNumber(),
          vICMS: vICMS.toNumber(),
          total: this.v_TotICMS.toNumber()
        });
      }
    }

    return icmsData;
  }

  /**
   * Calcula PIS (EXATAMENTE como no Pascal)
   */
  calcularPIS(det, VrCalculado, crt) {
    const ncm = det.NCM || "";
    let pisData = {};

    // Simples Nacional
    if (crt === "1") {
      pisData = {
        CST: "49",
        vBC: 0,
        pPIS: 0,
        vPIS: 0
      };
      
      this.log('PIS', 'Simples Nacional - não aplicável', { produto: det.CPROD });
    }
    // Regime Normal
    else {
      // Produto não tributável
      if (ncm === "38089429") {
        pisData = {
          CST: "04",
          vBC: 0,
          pPIS: 0,
          vPIS: 0
        };
        
        this.log('PIS', 'Produto não tributável', { produto: det.CPROD, ncm });
      } 
      // Produto normal - 1.65%
      else {
        const vPIS = VrCalculado.times(0.0165).toDecimalPlaces(2);

        pisData = {
          CST: "01",
          vBC: VrCalculado.toNumber(),
          pPIS: 1.65,
          vPIS: vPIS.toNumber()
        };

        // Acumular total
        this.v_TotPis = this.v_TotPis.plus(vPIS);

        this.log('PIS', 'Tributado 1.65%', {
          produto: det.CPROD,
          vBC: VrCalculado.toNumber(),
          vPIS: vPIS.toNumber(),
          total: this.v_TotPis.toNumber()
        });
      }
    }

    return pisData;
  }

  /**
   * Calcula COFINS (EXATAMENTE como no Pascal)
   */
  calcularCOFINS(det, VrCalculado, crt) {
    const ncm = det.NCM || "";
    let cofinsData = {};

    // Simples Nacional
    if (crt === "1") {
      cofinsData = {
        CST: "49",
        vBC: 0,
        pCOFINS: 0,
        vCOFINS: 0
      };
      
      this.log('COFINS', 'Simples Nacional - não aplicável', { produto: det.CPROD });
    }
    // Regime Normal
    else {
      // Produto não tributável
      if (ncm === "38089429") {
        cofinsData = {
          CST: "04",
          vBC: 0,
          pCOFINS: 0,
          vCOFINS: 0
        };
        
        this.log('COFINS', 'Produto não tributável', { produto: det.CPROD, ncm });
      } 
      // Produto normal - 7.60%
      else {
        const vCOFINS = VrCalculado.times(0.076).toDecimalPlaces(2);

        cofinsData = {
          CST: "01",
          vBC: VrCalculado.toNumber(),
          pCOFINS: 7.60,
          vCOFINS: vCOFINS.toNumber()
        };

        // Acumular total
        this.v_TotCofins = this.v_TotCofins.plus(vCOFINS);

        this.log('COFINS', 'Tributado 7.60%', {
          produto: det.CPROD,
          vBC: VrCalculado.toNumber(),
          vCOFINS: vCOFINS.toNumber(),
          total: this.v_TotCofins.toNumber()
        });
      }
    }

    return cofinsData;
  }

  /**
   * Calcula IBS/CBS - Reforma Tributária (EXATAMENTE como no Pascal)
   */
  calcularIBSCBS(det, VrCalculado, crt) {
    let ibscbsData = {};

    // Apenas para Regime Normal
    if (crt !== "1") {
      // IBS Estadual: 0.10%
      const vIBSUF = VrCalculado.times(0.001).toDecimalPlaces(2);
      
      // CBS Federal: 0.90%
      const vCBS = VrCalculado.times(0.009).toDecimalPlaces(2);

      ibscbsData = {
        CST: "000",
        cClassTrib: "000001",
        gIBSCBS: {
          vBC: VrCalculado.toNumber(),
          vIBS: vIBSUF.toNumber(),
          gIBSUF: {
            pIBSUF: 0.10,
            vIBSUF: vIBSUF.toNumber()
          },
          gIBSMun: {
            pIBSMun: 0,
            vIBSMun: 0
          },
          gCBS: {
            pCBS: 0.90,
            vCBS: vCBS.toNumber()
          }
        }
      };

      // Acumular totais
      this.v_TotIBSUF = this.v_TotIBSUF.plus(vIBSUF);
      this.v_TotCBS = this.v_TotCBS.plus(vCBS);

      this.log('IBS/CBS', 'Reforma Tributária', {
        produto: det.CPROD,
        vIBSUF: vIBSUF.toNumber(),
        vCBS: vCBS.toNumber(),
        totalIBS: this.v_TotIBSUF.toNumber(),
        totalCBS: this.v_TotCBS.toNumber()
      });
    } else {
      this.log('IBS/CBS', 'Simples Nacional - não aplicável', { produto: det.CPROD });
    }

    return ibscbsData;
  }

  /**
   * Processa um produto (equivalente ao bloco 'with Det.Add do' do Pascal)
   */
  processarProduto(item, index, vendaData) {
    const det = item.det;
    this.contador = index + 1;

    this.log('PRODUTO', `Processando item ${this.contador}`, { cProd: det.CPROD, xProd: det.XPROD });

    // 1. Calcular valor base
    const VrCalculado = this.calcularValorBase(det);
    const vrDesconto = new Decimal(det.VDESCONTO || 0);

    // 2. Acumular totais gerais
    this.V_ICMSTot_vNF = this.V_ICMSTot_vNF.plus(VrCalculado);
    this.V_Tot_Desconto = this.V_Tot_Desconto.plus(vrDesconto);

    // 3. Obter dados fiscais
    const crt = vendaData.data[0]?.venda.NFE_INFNFE_EMIT_CRT || "3";
    const uf = vendaData.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_UF || "SP";

    // 4. Calcular impostos
    const icmsData = this.calcularICMS(det, VrCalculado, crt, uf);
    const pisData = this.calcularPIS(det, VrCalculado, crt);
    const cofinsData = this.calcularCOFINS(det, VrCalculado, crt);
    const ibscbsData = this.calcularIBSCBS(det, VrCalculado, crt);

    // 5. Montar dados do produto
    const vrUnit = new Decimal(det.VUNCOM || 0);
    const qtd = new Decimal(det.QCOM || 0);

    return {
      nItem: this.contador,
      prod: {
        cProd: det.CPROD || "0001",
        cEAN: det.CEAN || "SEM GTIN",
        xProd: det.XPROD || "Produto sem descrição",
        NCM: det.NCM || "00000000",
        CFOP: det.CFOP || "5102",
        uCom: det.UCOM || "UN",
        qCom: qtd.toNumber(),
        vUnCom: vrUnit.toNumber(),
        vProd: vrUnit.times(qtd).toDecimalPlaces(2).toNumber(),
        vDesc: vrDesconto.toNumber(),
        cEANTrib: det.CEANTRIB || "SEM GTIN",
        uTrib: det.UTRIB || "UN",
        qTrib: qtd.toNumber(),
        vUnTrib: vrUnit.toNumber(),
        indTot: det.INDTOT || "1"
      },
      imposto: {
        vTotTrib: 0,
        ICMS: icmsData,
        PIS: pisData,
        COFINS: cofinsData,
        IBSCBS: ibscbsData
      }
    };
  }

  /**
   * Calcula totais da nota (equivalente ao Total.ICMSTot do Pascal)
   */
  calcularTotais(crt) {
    const totais = {
      ICMSTot: {
        vBC: (crt === "1") ? 0 : this.V_ICMSTot_vNF.toNumber(),
        vICMS: this.v_TotICMS.toNumber(),
        vICMSDeson: 0,
        vFCP: 0,
        vBCST: 0,
        vST: 0,
        vFCPST: 0,
        vFCPSTRet: 0,
        vProd: this.V_ICMSTot_vNF.plus(this.V_Tot_Desconto).toNumber(),
        vFrete: 0,
        vSeg: 0,
        vDesc: this.V_Tot_Desconto.toNumber(),
        vII: 0,
        vIPI: 0,
        vIPIDevol: 0,
        vPIS: this.v_TotPis.toNumber(),
        vCOFINS: this.v_TotCofins.toNumber(),
        vOutro: 0,
        vNF: this.V_ICMSTot_vNF.toNumber()
      },
      IBSCBSTot: {
        vBCIBSCBS: this.V_ICMSTot_vNF.toNumber(),
        gIBS: {
          vIBS: this.v_TotIBSUF.toNumber(),
          vCredPres: 0,
          vCredPresCondSus: 0,
          gIBSUF: {
            vDif: 0,
            vDevTrib: 0,
            vIBSUF: this.v_TotIBSUF.toNumber()
          },
          gIBSMun: {
            vDif: 0,
            vDevTrib: 0,
            vIBSMun: 0
          }
        },
        gCBS: {
          vDif: 0,
          vDevTrib: 0,
          vCBS: this.v_TotCBS.toNumber(),
          vCredPres: 0,
          vCredPresCondSus: 0
        }
      },
      vNFTot: this.V_ICMSTot_vNF.toNumber()
    };

    this.log('TOTAIS', 'Totalizadores da NF-e', totais);

    return totais;
  }

  /**
   * Calcula Lei da Transparência (equivalente ao OlhoImposto_Fed/UF do Pascal)
   */
  calcularLeiTransparencia() {
    const OlhoImposto_Fed = this.V_ICMSTot_vNF.times(0.2524).toDecimalPlaces(2);
    const OlhoImposto_UF = this.V_ICMSTot_vNF.times(0.1941).toDecimalPlaces(2);

    const infCpl = 
      `Você pagou aproximadamente R$ ${OlhoImposto_Fed.toFixed(2)} tributos federais; ` +
      `R$ ${OlhoImposto_UF.toFixed(2)} tributos estaduais; ` +
      `R$ 0,00 tributos municipais. Fonte: IBPT/FECOMERCIO RS`;

    this.log('LEI_TRANSPARENCIA', 'IBPT calculado', {
      federal: OlhoImposto_Fed.toNumber(),
      estadual: OlhoImposto_UF.toNumber()
    });

    return infCpl;
  }

  /**
   * Gera XML da NFC-e/NF-e (método principal)
   */
  async gerarNFCe(idVenda) {
    try {
      this.log('INICIO', `Gerando NFC-e para venda ${idVenda}`);

      // 1. Buscar dados da venda
      const response = await axios.get(
        `${url}/api/venda/lista-venda-new-xml.xsjs?id=${idVenda}`,
        { timeout: 10000 }
      );
      const vendaData = response.data;

      // 2. Validar dados
      validarDadosVenda(vendaData);
      this.log('VALIDACAO', 'Dados da venda validados com sucesso');

      const venda = vendaData.data[0].venda;
      const itens = vendaData.data[0].detalhe;

      // 3. Processar produtos e calcular impostos
      const produtosComImpostos = itens.map((item, index) => 
        this.processarProduto(item, index, vendaData)
      );

      // 4. Calcular totais
      const crt = venda.NFE_INFNFE_EMIT_CRT || "3";
      const totais = this.calcularTotais(crt);

      // 5. Lei da Transparência
      const infCpl = this.calcularLeiTransparencia();

      // 6. Montar estrutura completa
      const chaveRaw = venda.CHAVE || "";
      const chave = chaveRaw.replace(/^NFe/i, '').replace(/\D/g, '').slice(0, 44);

      const estruturaCompleta = {
        ide: {
          chave: chave,
          cUF: ufToCodigo(venda.NFE_INFNFE_EMIT_ENDEREMIT_UF),
          cNF: venda.NFE_INFNFE_IDE_CNF || "00000000",
          natOp: venda.NFE_INFNFE_IDE_NATOP || "VENDA",
          mod: venda.NFE_INFNFE_IDE_MOD || "65",
          serie: venda.NFE_INFNFE_IDE_SERIE || "0",
          nNF: venda.NFE_INFNFE_IDE_NNF || "",
          dhEmi: venda.NFE_INFNFE_IDE_DHEMI || new Date().toISOString(),
          tpNF: venda.NFE_INFNFE_IDE_TPNF || "1",
          idDest: venda.NFE_INFNFE_IDE_IDDEST || "1",
          cMunFG: venda.NFE_INFNFE_IDE_CMUNFG || "3550308",
          tpImp: venda.NFE_INFNFE_IDE_TPIMP || "2",
          tpEmis: venda.NFE_INFNFE_IDE_TPEMIS || "1",
          cDV: venda.NFE_INFNFE_IDE_CDV || "0",
          tpAmb: venda.NFE_INFNFE_IDE_TPAMB || 2,
          finNFe: venda.NFE_INFNFE_IDE_FINNFE || "1",
          indFinal: venda.NFE_INFNFE_IDE_INDFINAL || "1",
          indPres: venda.NFE_INFNFE_IDE_INDPRES || "1",
          procEmi: venda.NFE_INFNFE_IDE_PROCEMI || "0",
          verProc: "1.0"
        },
        emit: {
          CNPJ: venda.NFE_INFNFE_EMIT_CNPJ,
          xNome: venda.NFE_INFNFE_EMIT_NOME || "Emitente",
          xFant: venda.NFE_INFNFE_EMIT_FANT || "",
          enderEmit: {
            xLgr: venda.NFE_INFNFE_EMIT_ENDEREMIT_XLGR || "Endereco",
            nro: venda.NFE_INFNFE_EMIT_ENDEREMIT_NRO || "0",
            xBairro: venda.NFE_INFNFE_EMIT_ENDEREMIT_XBAIRRO || "Bairro",
            cMun: venda.NFE_INFNFE_EMIT_ENDEREMIT_CMUN || "3550308",
            xMun: venda.NFE_INFNFE_EMIT_ENDEREMIT_XMUN || "Sao Paulo",
            UF: venda.NFE_INFNFE_EMIT_ENDEREMIT_UF || "SP",
            CEP: venda.NFE_INFNFE_EMIT_ENDEREMIT_CEP || "01000000",
            cPais: venda.NFE_INFNFE_EMIT_ENDEREMIT_CPAIS || "1058",
            xPais: venda.NFE_INFNFE_EMIT_ENDEREMIT_XPAIS || "BRASIL",
            fone: venda.NFE_INFNFE_EMIT_ENDEREMIT_FONE || ""
          },
          IE: venda.NFE_INFNFE_EMIT_IE || "",
          CRT: venda.NFE_INFNFE_EMIT_CRT || "1"
        },
        produtos: produtosComImpostos,
        totais: totais,
        transp: {
          modFrete: venda.NFE_INFNFE_TRANSP_MODFRETE || "9"
        },
        pag: {
          detPag: vendaData.data[0]?.pagamento?.map(p => ({
            tPag: p.pag.TPAG || "01",
            vPag: p.pag.VALORRECEBIDO || "0"
          })) || []
        },
        infAdic: {
          infCpl: infCpl
        }
      };

      this.log('SUCESSO', 'NFC-e gerada com sucesso', {
        totalProdutos: produtosComImpostos.length,
        totalICMS: this.v_TotICMS.toNumber(),
        totalPIS: this.v_TotPis.toNumber(),
        totalCOFINS: this.v_TotCofins.toNumber(),
        totalNF: this.V_ICMSTot_vNF.toNumber()
      });

      return {
        success: true,
        estrutura: estruturaCompleta,
        logs: this.logs
      };

    } catch (error) {
      this.log('ERRO', error.message, { stack: error.stack });
      throw error;
    }
  }
}

/**
 * =============================================================================
 * CONTROLLER PARA EXPRESS.JS
 * =============================================================================
 */
class NFCeController {
  async gerarNFCe(req, res) {
    try {
      const { idVenda } = req.query;

      if (!idVenda) {
        return res.status(400).json({ 
          error: "idVenda é obrigatório",
          exemplo: "/api/nfce/gerar?idVenda=2-1-15"
        });
      }

      // Criar instância do gerador
      const gerador = new GeradorNFCe();

      // Gerar NFC-e
      const resultado = await gerador.gerarNFCe(idVenda);

      // Retornar resultado
      return res.json({
        success: true,
        message: "NFC-e gerada com sucesso",
        data: resultado.estrutura,
        auditoria: {
          totalLogs: resultado.logs.length,
          logs: resultado.logs.slice(-10) // Últimos 10 logs
        }
      });

    } catch (error) {
      console.error('[ERRO]', error);
      
      return res.status(500).json({
        success: false,
        error: error.message,
        detalhes: error.stack
      });
    }
  }
}

/**
 * =============================================================================
 * EXPORTS
 * =============================================================================
 */
export default new NFCeController();
export { GeradorNFCe, roundToDecimal, ufToCodigo, validarDadosVenda };