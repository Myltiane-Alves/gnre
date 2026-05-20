// import { Make, Tools } from 'node-sped-nfe';
// import fs from 'fs';
// import path from "node:path";
// import axios from 'axios';
// import 'dotenv/config';
// const url = process.env.API_URL;

// async function getCertOptions(senha, fallbackPfxPath = './GTO COMERCIO 2025-2026.pfx') {
//   // 1) PFX via env base64
//   const pfxBase64 = process.env.CERT_PFX_BASE64;
//   if (pfxBase64) {
//     try {
//       const pfxBuf = Buffer.from(pfxBase64, 'base64');
//       // tenta gravar em um tmp para compatibilidade com bibliotecas que pedem caminho
//       let tmpPath = null;
//       try {
//         tmpPath = path.join(os.tmpdir(), fallbackPfxPath.replace(/[^a-zA-Z0-9.\-_]/g, '_'));
//         fs.writeFileSync(tmpPath, pfxBuf, { flag: 'w' });
//         process.env.CERT_PFX_PATH = tmpPath;
//       } catch (e) {
//         // se não gravar, não é crítico — ainda temos o buffer
//         console.warn('getCertOptions: não foi possível gravar PFX em tmp:', e?.message || e);
//       }
//       return { pfx: pfxBuf, senha, pfxPath: tmpPath };
//     } catch (e) {
//       console.error('getCertOptions: falha ao decodificar CERT_PFX_BASE64:', e?.message || e);
//     }
//   }

//   // 2) PFX arquivo local
//   if (fs.existsSync(fallbackPfxPath)) {
//     try {
//       const pfxBuf = fs.readFileSync(fallbackPfxPath);
//       process.env.CERT_PFX_PATH = fallbackPfxPath;
//       return { pfx: pfxBuf, senha, pfxPath: fallbackPfxPath };
//     } catch (e) {
//       console.warn('getCertOptions: falha ao ler PFX local:', e?.message || e);
//     }
//   }

//   // 3) PEM via envs base64
//   const pemCertBase64 = process.env.CERT_PEM_CERT_BASE64;
//   const pemKeyBase64 = process.env.CERT_PEM_KEY_BASE64;
//   if (pemCertBase64 && pemKeyBase64) {
//     try {
//       const certBuf = Buffer.from(pemCertBase64, 'base64');
//       const keyBuf = Buffer.from(pemKeyBase64, 'base64');
//       try {
//         const certPath = path.join(os.tmpdir(), 'cert.pem');
//         const keyPath = path.join(os.tmpdir(), 'key.pem');
//         fs.writeFileSync(certPath, certBuf, { flag: 'w' });
//         fs.writeFileSync(keyPath, keyBuf, { flag: 'w' });
//         process.env.CERT_PEM_CERT_PATH = certPath;
//         process.env.CERT_PEM_KEY_PATH = keyPath;
//       } catch (e) {
//         console.warn('getCertOptions: não foi possível gravar PEMs em tmp:', e?.message || e);
//       }
//       return { cert: certBuf, key: keyBuf };
//     } catch (e) {
//       console.error('getCertOptions: falha ao decodificar CERT_PEM_*_BASE64:', e?.message || e);
//     }
//   }

//   // 4) PEM via caminhos já apontados no ambiente
//   const certPathEnv = process.env.CERT_PEM_CERT_PATH;
//   const keyPathEnv = process.env.CERT_PEM_KEY_PATH;
//   if (certPathEnv && keyPathEnv && fs.existsSync(certPathEnv) && fs.existsSync(keyPathEnv)) {
//     try {
//       const certBuf = fs.readFileSync(certPathEnv);
//       const keyBuf = fs.readFileSync(keyPathEnv);
//       return { cert: certBuf, key: keyBuf };
//     } catch (e) {
//       console.warn('getCertOptions: falha ao ler PEMs dos caminhos apontados:', e?.message || e);
//     }
//   }

//   // nada encontrado
//   return null;
// }

// export function roundTo(valor, casasDecimais) {
//   const multiplicador = Math.pow(10, Math.abs(casasDecimais));
//   return Math.round(valor * multiplicador) / multiplicador;
// }
// class ConsultaNFeController {
//   async consultaNFe(req, res) {
//     try {
//       let { idVenda } = req.body;

//       if (!idVenda) {
//         return res.status(400).json({ error: "idVenda é obrigatório" });
//       }


//       function ufToCodigo(uf) {
//         const map = {
//           "RO": "11", "AC": "12", "AM": "13", "RR": "14", "PA": "15", "AP": "16", "TO": "17",
//           "MA": "21", "PI": "22", "CE": "23", "RN": "24", "PB": "25", "PE": "26", "AL": "27", "SE": "28", "BA": "29",
//           "MG": "31", "ES": "32", "RJ": "33", "SP": "35", "PR": "41", "SC": "42", "RS": "43", "MS": "50", "MT": "51", "GO": "52", "DF": "53"
//         };
//         if (!uf) return "35";
//         const u = uf.toUpperCase();
//         return map[u] || "35";
//       }

//       const response = await axios.get(`${url}/api/venda/lista-venda-new-xml.xsjs?id=${idVenda}`);
//       const vendaData = response.data;
      
//       let v_TotICMS = 0;
//       let v_TotPis = 0;

//       let v_TotCofins = 0;
//       let v_TotIBSUF = 0;
//       let v_TotCBS = 0;
//       let V_Tot_Desconto = 0;
//       let V_ICMSTot_vNF = 0;

//       function gerarXML(venda) {

//         // ========================= FUNÇÃO DE FORMATAÇÃO DECIMAL =========================
//         const formatDecimal = (value, decimals = 2) => {
//           if (value === null || value === undefined || value === "") {
//             return decimals === 2 ? "0.00" : "0.0000";
//           }
//           const strValue = String(value).trim();
//           const num = parseFloat(strValue);
//           if (isNaN(num)) {
//             return decimals === 2 ? "0.00" : "0.0000";
//           }
//           return num.toFixed(decimals);
//         };
//         // ================================================================================

//         const uf = venda.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_UF;
//         const cnf = venda.data[0]?.venda.NFE_INFNFE_IDE_CNF || "00000000";
//         const natOp = venda.data[0]?.venda.NFE_INFNFE_IDE_NATOP || "VENDA";
//         const mod = venda.data[0]?.venda.NFE_INFNFE_IDE_MOD || "65";
//         const serie = venda.data[0]?.venda.NFE_INFNFE_IDE_SERIE || "01";
//         const nnf = venda.data[0]?.venda.NFE_INFNFE_IDE_NNF || "";

//         // IMPORTANTE: Data deve estar em formato DDMM (dia+mês), não MMDD
//         const dataObj = new Date();
//         const dia = String(dataObj.getDate()).padStart(2, '0');
//         const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
//         const data = dia + mes; // DDMM correto

//         // const chaveRaw = venda.data[0]?.venda.CHAVE || "";
//         // const chave = chaveRaw.replace(/^NFe/i, '').replace(/\D/g, '').slice(0, 44);

//         const tpNF = venda.data[0]?.venda.NFE_INFNFE_IDE_TPNF || "1";
//         const idDest = venda.data[0]?.venda.NFE_INFNFE_IDE_IDDEST || "1";
//         const cMunFG = venda.data[0]?.venda.NFE_INFNFE_IDE_CMUNFG || "3550308";
//         const tpImp = venda.data[0]?.venda.NFE_INFNFE_IDE_TPIMP;
//         const tpEmis = venda.data[0]?.venda.NFE_INFNFE_IDE_TPEMIS;
//         const cDV = venda.data[0]?.venda.NFE_INFNFE_IDE_CDV || "0";
//         const tpAmb = String(venda.data[0]?.venda.NFE_INFNFE_IDE_TPAMB);
//         const finNFe = venda.data[0]?.venda.NFE_INFNFE_IDE_FINNFE;
//         const indFinal = venda.data[0]?.venda.NFE_INFNFE_IDE_INDFINAL;
//         const indPres = venda.data[0]?.venda.NFE_INFNFE_IDE_INDPRES;
//         const cnpj = venda.data[0]?.venda?.NFE_INFNFE_EMIT_CNPJ;

//         const ufCode = String(ufToCodigo(uf)).padStart(2, '0');
//         const dataPadded = String(data).padStart(4, '0'); // DDMM
//         const cnpjPadded = String(cnpj || '').padStart(14, '0');
//         const modPadded = String(mod || '').padStart(2, '0');
//         const seriePadded = String(serie || '').padStart(2, '0');
//         const nnfPadded = String(nnf || '').padStart(8, '0'); // NNF: 16203 → 00016203 (8 dígitos)
//         const cnfPadded = String(cnf || '').padStart(8, '0'); // CNF: 67691092 → 67691092 (8 dígitos)

//         // NOTA: O Make() calcula a chave e DV automaticamente baseado nos valores de ide
//         // Não devemos tentar calcular manualmente - deixar a biblioteca fazer
//         // Mas vamos deixar esse debug para comparação
//         const chaveBase = ufCode + dataPadded + cnpjPadded + modPadded + seriePadded + nnfPadded + cnfPadded;


//         console.log("🔧 === CONSTRUÇÃO DA CHAVE (informativo) ===");
//         console.log("   ufCode:", ufCode, "(esperado: 53)");
//         console.log("   dataPadded:", dataPadded);
//         console.log("   cnpjPadded:", cnpjPadded);
//         console.log("   modPadded:", modPadded);
//         console.log("   seriePadded:", seriePadded);
//         console.log("   nnfPadded:", nnfPadded);
//         console.log("   cnfPadded:", cnfPadded);
//         console.log("   NOTA: Chave será calculada pelo Make()");
//         console.log("===========================");

//         const cnpjAutxml = venda.data[0]?.venda?.NFE_INFNFE_AUTXML_CNPJ || "00000000000000";
//         const nome = venda.data[0]?.venda.NFE_INFNFE_EMIT_NOME || "Emitente Padrão";
//         const nomeFantasia = venda.data[0]?.venda.NFE_INFNFE_EMIT_FANT || "Fantasia Padrão";
//         const cep = venda.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_CEP || "01000000";
//         const xPais = venda.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_XPAIS || "1058";
//         const cPais = venda.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_CPAIS || "BRASIL";
//         const fone = venda.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_FONE || "0000000000";
//         const cMun = venda.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_CMUN || "3550308";
//         const xMun = venda.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_XMUN || "Sao Paulo";
//         const xBairro = venda.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_XBAIRRO || "Bairro";
//         const nro = venda.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_NRO || "0";
//         const xLgr = venda.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_XLGR || "Endereco";
//         const emit_IE = venda.data[0]?.venda.NFE_INFNFE_EMIT_IE || "";
//         const emit_CRT = venda.data[0]?.venda.NFE_INFNFE_EMIT_CRT || "1";
//         const infCpl = venda.data[0]?.venda.NFE_INFNFE_INFADIC_INFCPL || "Nenhuma informação adicional";
//         const modFrete = venda.data[0]?.venda.NFE_INFNFE_TRANSP_MODFRETE || "9";
//         const qrCode = venda.data[0]?.venda.NFE_INFNFESUPL_QRCODE || "";
//         const procEmi = venda.data[0]?.venda.NFE_INFNFE_IDE_PROCEMI || "0";
//         const urlChave = venda.data[0]?.venda.NFE_INFNFESUPL_URLCHAVE || "www.fazenda.df.gov.br/nfce/consulta";

//         // Gerar dhEmi no momento da emissão com formato Brasil (-03:00)
//         const formatarDataBrasil = () => {
//           const d = new Date();
//           const year = d.getFullYear();
//           const month = String(d.getMonth() + 1).padStart(2, '0');
//           const day = String(d.getDate()).padStart(2, '0');
//           const hours = String(d.getHours()).padStart(2, '0');
//           const minutes = String(d.getMinutes()).padStart(2, '0');
//           const seconds = String(d.getSeconds()).padStart(2, '0');
//           return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`;
//         };
//         const dhEmi = formatarDataBrasil();

//         // MAPEAMENTO: Códigos do banco → Códigos SEFAZ
//         function mapearTipoPagamento(tPagBanco) {
//           const mapeamento = {
//             '001': '01',  // Dinheiro
//             '002': '02',  // Cheque
//             '003': '03',  // Cartão Crédito
//             '004': '04',  // Cartão Débito
//             '005': '05',  // Crédito Loja
//             '009': '03',  // Credsystem → Cartão Crédito
//             '010': '10',  // Vale Alimentação
//             '011': '11',  // Vale Refeição
//             '012': '12',  // Vale Presente
//             '013': '13',  // Vale Combustível
//             '015': '15',  // Boleto Bancário
//             '016': '16',  // Depósito Bancário
//             '017': '17',  // PIX
//             '018': '18',  // Transferência Bancária
//             '031': '03',  // Outros cartões → Cartão Crédito
//             '090': '90',  // Sem pagamento
//             '099': '99'   // Outros
//           };

//           return mapeamento[tPagBanco] ?? '99';
//         }

//         // AGRUPAR PAGAMENTOS POR tPag (soma valores do mesmo tipo)
//         function agruparPagamentos(pagamentos) {
//           if (!pagamentos || pagamentos.length === 0) {
//             return [{ tPag: "01", vPag: "0.00" }];
//           }

//           const agrupados = {};

//           pagamentos.forEach(p => {
//             const tPagBanco = p.pag.TPAG || "OUTROS";
//             const tPagSefaz = mapearTipoPagamento(tPagBanco);
//             const valor = parseFloat(p.pag.VALORRECEBIDO || 0);

//             if (!agrupados[tPagSefaz]) {
//               agrupados[tPagSefaz] = 0;
//             }

//             agrupados[tPagSefaz] += valor;
//           });

//           // Converter objeto em array
//           return Object.entries(agrupados).map(([tPag, vPag]) => ({
//             tPag: tPag,
//             vPag: vPag.toFixed(2)
//           }));
//         }

//         const pagamentosAgrupados = agruparPagamentos(venda.data[0]?.pagamento);

//         function montarItens(venda) {
//           const itens = venda.data[0]?.detalhe || [];

//           return itens.map((item, index) => {
//             const det = item.det;

//             return {
//               nItem: index + 1,
//               prod: {
//                 cProd: det.CPROD,
//                 cEAN: det.CEAN,
//                 xProd: det.XPROD,
//                 NCM: det.NCM,
//                 CFOP: det.CFOP,
//                 uCom: det.UCOM,
//                 qCom: formatDecimal(det.QCOM, 4),
//                 vUnCom: formatDecimal(det.VUNCOM),
//                 vProd: formatDecimal(det.VPROD),
//                 cEANTrib: det.CEANTRIB,
//                 uTrib: det.UTRIB,
//                 qTrib: formatDecimal(det.QTRIB, 4),
//                 vUnTrib: formatDecimal(det.VUNTRIB),
//                 indTot: det.INDTOT
//               },

//               imposto: {
//                 ICMS: {
//                   ICMS00: {
//                     orig: det.ICMS_ORIG || "0",
//                     CST: det.ICMS_CST || "00",
//                     modBC: det.ICMS_MODBC || "3",
//                     vBC: formatDecimal(det.ICMS_VBC),
//                     pICMS: formatDecimal(det.ICMS_PICMS),
//                     vICMS: formatDecimal(det.ICMS_VICMS)
//                   }
//                 },

//                 PIS: {
//                   PISAliq: {
//                     CST: det.PIS_CST || "01",
//                     vBC: formatDecimal(det.PIS_VBC),
//                     pPIS: formatDecimal(det.PIS_PPIS),
//                     vPIS: formatDecimal(det.PIS_VPIS)
//                   }
//                 },

//                 COFINS: {
//                   COFINSAliq: {
//                     CST: det.COFINS_CST || "01",
//                     vBC: formatDecimal(det.COFINS_VBC),
//                     pCOFINS: formatDecimal(det.COFINS_PCOFINS),
//                     vCOFINS: formatDecimal(det.COFINS_VCOFINS)
//                   }
//                 },

//                 ISSQN: det.IS_CST
//                   ? {
//                     ISSQN: {
//                       cSitTrib: det.IS_CST || "N",
//                       cListServ: det.IS_CCLASSTRIBIS || "0000",
//                       vBC: det.IS_VBC || "0.00",
//                       vAliq: det.IS_VALIQ || "0.00",
//                       vISSQN: det.IS_VISSQN || "0.00"
//                     }
//                   }
//                   : undefined
//               }
//             };
//           });
//         }
       
//         const payload = {
//           ide: {
//             cUF: ufToCodigo(uf),
//             cNF: cnf,
//             natOp: natOp,
//             mod: mod,
//             serie: serie,
//             nNF: nnf,
//             dhEmi: dhEmi,
//             tpNF: tpNF,
//             idDest: idDest,
//             cMunFG: cMunFG,
//             tpImp: tpImp,
//             tpEmis: tpEmis,
//             cDV: cDV,
//             tpAmb: tpAmb,
//             finNFe: finNFe,
//             indFinal: indFinal,
//             indPres: indPres,
//             procEmi: procEmi,
//             verProc: "1.0",
//           },
//           emit: {
//             CNPJ: cnpj,
//             xNome: nome,
//             xFant: nomeFantasia,
//             enderEmit: {
//               xLgr: xLgr,
//               nro: nro,
//               xBairro: xBairro,
//               cMun: cMun,
//               xMun: xMun,
//               UF: uf,
//               CEP: cep,
//               cPais: cPais,
//               xPais: xPais,
//             },
//             IE: emit_IE,
//             CRT: emit_CRT
//           },
//           autXML: {
//             CNPJ: cnpjAutxml,
//           },
//           det: montarItens(venda),
//           transp: {
//             modFrete: modFrete
//           },
//           pag: {
//             detPag: pagamentosAgrupados
//           },
//           infAdic: {
//             infCpl: infCpl
//           },
//           infNFeSupl: {
//             qrCode: qrCode,
//             urlChave: urlChave
//           }
//         };

//         return payload;
//       }
//       const payload = gerarXML(response.data);

//       // Extrair variáveis de protocolo para usar no tagInfAdic
//       const nProtRaw = response.data.data[0]?.venda.PROTNFE_INFPROT_ID || "";
//       const nProt = nProtRaw.replace(/^ID/i, '');
//       const digVal = response.data.data[0]?.venda.PROTNFE_INFPROT_DIGVAL || "";
//       const cStat = response.data.data[0]?.venda.PROTNFE_INFPROT_CSTAT || "100";
//       const xMotivo = response.data.data[0]?.venda.PROTNFE_INFPROT_XMOTIVO || "Autorizado o uso da NF-e";

//       const configData = response.data.data[0]?.configuracao?.[0]?.config || {};
//       const tpAmbiente = configData.TPAMBIENTE || "2"; // CRÍTICO!
    

//       const dsCRT = configData.DSCRT || "";
//       const cscId = configData.IDTOKEN || "1";
//       const csc = configData.TOKENCSC || "";


//       // Usa getCertOptions para carregar o certificado
//       const SENHA_CERT = process.env.SENHA || "#senhagto2024#";
//       const certOptions = await getCertOptions(SENHA_CERT, './GTO COMERCIO 2025-2026.pfx');

//       if (!certOptions) {
//         return res.status(500).json({
//           error: 'Não foi possível carregar o certificado. Verifique as variáveis de ambiente ou o arquivo local.'
//         });
//       }

//       const tpAmbTools = parseInt(tpAmbiente) || 2;
//       const ufTools = configData.UF || payload.emit.enderEmit.UF;

    
//       // VALIDAÇÃO CRÍTICA
//       console.log("🔧 === VALIDAÇÃO TOOLS ===");
//       console.log("   mod: '65'", csc ? "✓" : "⚠️");
//       console.log("   tpAmb:", tpAmbTools, typeof tpAmbTools === 'number' ? "✓" : "❌");
//       console.log("   UF:", ufTools, ufTools && ufTools !== "" ? "✓" : "❌");
//       console.log("   CSC:", csc && csc.trim() ? "✓" : "❌ VAZIO!");
//       console.log("   CSCid:", cscId, "✓");
//       console.log("   certOptions:", certOptions ? "✓ carregado" : "❌ vazio");
//       console.log("==========================");

//       if (!csc || csc.trim() === "") {
//         console.error("❌ ERRO: CSC vazio - não é possível gerar NFC-e");
//         return res.status(400).json({
//           error: "CSC (Token) não configurado",
//           details: { csc: "vazio", cscId }
//         });
//       }

//       if (!ufTools || ufTools === "") {
//         console.error("❌ ERRO: UF inválido:", payload.emit.enderEmit.UF);
//         return res.status(400).json({
//           error: "UF não identificado",
//           received: payload.emit.enderEmit.UF
//         });
//       }
//       // Configurar variáveis de ambiente para OpenSSL 3.x
//       // const opensslPath = path.resolve("./libs/openssl/bin/openssl.exe");
//       // const opensslModulesPath = path.resolve("./libs/openssl/lib/ossl-modules");
//       // process.env.OPENSSL_MODULES = opensslModulesPath;
//       console.log(ufTools, 'ufTools');
//       let tools = new Tools({
//         mod: "55",
//         tpAmb: 2,
//         // UF: 'MT',
//         UF: ufTools,
//         versao: '4.00',
//         timeout: 60,
//         CSC: csc,
//         CSCid: String(cscId),
//         // xmllint: path.resolve("./libs/libxml/bin/xmllint.exe"),
//         // openssl: path.resolve("./libs/openssl/bin/openssl.exe"),
//       }, certOptions);


//       let NFe = new Make()
//       NFe.tagInfNFe({
//         Id: null,
//         versao: "4.00"
//       });

      
//       NFe.tagIde({
//         cUF: payload.ide.cUF,
//         cNF: payload.ide.cNF,
//         natOp: payload.ide.natOp,
//         mod: String(payload.ide.mod),
//         serie: payload.ide.serie,
//         nNF: payload.ide.nNF,
//         dhEmi: payload.ide.dhEmi,
//         tpNF: payload.ide.tpNF,
//         idDest: payload.ide.idDest,
//         cMunFG: payload.ide.cMunFG,
//         tpImp: payload.ide.tpImp,
//         tpEmis: payload.ide.tpEmis,
//         cDV: payload.ide.cDV,
//         tpAmb: payload.ide.tpAmb,
//         finNFe: payload.ide.finNFe,
//         indFinal: payload.ide.indFinal,
//         indPres: payload.ide.indPres,
//         indIntermed: "0",
//         procEmi: payload.ide.procEmi,
//         verProc: payload.ide.verProc,
//       })

//       NFe.tagEmit({
//         CNPJ: payload.emit.CNPJ,
//         xNome: payload.emit.xNome,
//         xFant: payload.emit.xFant,
//         IE: payload.emit.IE,
//         CRT: payload.emit.CRT,
//       })


//       NFe.tagEnderEmit({
//         xLgr: payload.emit.enderEmit.xLgr,
//         nro: payload.emit.enderEmit.nro,
//         xBairro: payload.emit.enderEmit.xBairro,
//         cMun: payload.emit.enderEmit.cMun,
//         xMun: payload.emit.enderEmit.xMun,
//         UF: payload.emit.enderEmit?.UF,
//         CEP: payload.emit.enderEmit.CEP,
//         cPais: payload.emit.enderEmit.cPais,
//         xPais: payload.emit.enderEmit.xPais
//       })

//       NFe.tagAutXML({
//         CNPJ: payload.autXML.CNPJ
//       })
//       // Processar cada item do detalhe

//       const itens = vendaData.data[0]?.detalhe || [];

//       // Primeiro: construir array de produtos para passar ao tagProd
//       const produtosArray = itens.map((item, index) => {
//         const det = item.det;
//         const vrUnit = parseFloat(det.VUNCOM) || 0;
//         const qtd = parseFloat(det.QCOM) || 0;
//         const vDesconto = parseFloat(det.VDESC) || 0;

//         const produto = {
//           cProd: det.CPROD,
//           cEAN: det.CEAN || "SEM GTIN",
//           xProd: det.XPROD,
//           NCM: det.NCM,
//           CFOP: det.CFOP,
//           uCom: det.UCOM,
//           qCom: det.QCOM,
//           vUnCom: parseFloat(det.VUNCOM),
//           vProd: roundTo(vrUnit * qtd, 2),
//           cEANTrib: det.CEANTRIB || "SEM GTIN",
//           uTrib: det.UTRIB,
//           qTrib: det.QTRIB,
//           vUnTrib: parseFloat(det.VUNTRIB),
//           indTot: det.INDTOT
//         };

//         // Só adicionar vDesc se for maior que 0
//         if (vDesconto > 0) {
//           produto.vDesc = vDesconto.toFixed(2);
//         }

//         return produto;
//       });

//       // Passar array completo de produtos de uma vez
//       NFe.tagProd(produtosArray);

//       // Segundo: calcular impostos e aplicar para cada produto
//       itens.forEach((item, index) => {
//         const det = item.det;

//         //1. Calcular valor base do Item
//         const vrUnit = parseFloat(det.VUNCOM) || 0;
//         const qtd = parseFloat(det.QCOM) || 0;
//         const vrDesconto = parseFloat(det.VDESC) || 0;

//         // Fórmula: VrCalculado = (VrUnit * qtd) - VrDesconto
//         const VrCalculado = roundTo((vrUnit * qtd) - vrDesconto, 2);

//         // Acumular total da nota e descontos
//         V_ICMSTot_vNF += VrCalculado;
//         V_Tot_Desconto += vrDesconto;


//         // 2. VERIFICAR REGIME TRIBUTÁRIO (usar CRT do banco)
//         const crt = String(vendaData.data[0]?.venda.NFE_INFNFE_EMIT_CRT || "3");
//         const uf = vendaData.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_UF || "SP";
//         const ncm = det.NCM || "";

//         // Calcular ICMS
//         let icmsData = {}

//         if (crt === "1") {
//           // Simples Nacional (CRT = 1)
//           icmsData = {
//             orig: "0",
//             CSOSN: "102"
//           };
//           // Simples Nacional: NÃO acumula v_TotICMS
//         } else {
//           // Regime Normal
//           if ((ncm === "38089429" || ncm === "22072019") && uf === "DF") {
//             icmsData = {
//               orig: "0",
//               CST: "40", // ISENTO
//               vBC: "0.00",
//               pICMS: "0.00",
//               vICMS: "0.00"
//             };
//             // Não acumula ICMS
//           } else {
//             // Caso 2: Outros Produtos
//             let pICMS = 19.00;

//             if (uf === "DF") {
//               // DF: usa % do produto se >= 12, senão 20%
//               const percProduto = parseFloat(det.ICMS_PICMS) || 0;
//               pICMS = (percProduto >= 12) ? percProduto : 20.00;
//             }

//             const vICMS = roundTo(VrCalculado * (pICMS / 100), 2);

//             icmsData = {
//               orig: "0", // Nacional
//               CST: "00", // TRIBUTADO INTEGRALMENTE
//               modBC: "3", // Valor da Operação
//               vBC: VrCalculado.toFixed(2),
//               pICMS: pICMS.toFixed(2),
//               vICMS: vICMS.toFixed(2)
//             };

//             // Acumular total de ICMS
//             v_TotICMS += vICMS;
//           }
//         }

//         // 4. Calcular PIS
//         let pisData = {}

//         if (crt === "1") {
//           // Simples Nacional: PIS não aplicável na nota
//           pisData = { CST: "49", vBC: "0.00", pPIS: "0.00", vPIS: "0.00" };
//         } else {
//           if (ncm === "38089429") {
//             // Produto não tributável
//             pisData = {
//               CST: "04",  // Operação não tributável
//               vBC: "0.00",
//               pPIS: "0.00",
//               vPIS: "0.00"
//             };
//           } else {
//             // Produto normal: 1.65%
//             const vPIS = roundTo(VrCalculado * 0.0165, 2);

//             pisData = {
//               CST: "01",  // Operação tributável
//               vBC: VrCalculado.toFixed(2),
//               pPIS: "1.65",
//               vPIS: vPIS.toFixed(2)
//             }

//             // Acumular total de PIS
//             v_TotPis += vPIS;
//           }
//         }

//         // 5. Calcular COFINS
//         let cofinsData = {}

//         if (crt === "1") {
//           // Simples Nacional: COFINS não aplicável na nota
//           cofinsData = { CST: "49", vBC: "0.00", pCOFINS: "0.00", vCOFINS: "0.00" };
//         } else {
//           if (ncm === "38089429") {
//             // Produto não tributável
//             cofinsData = {
//               CST: "04",  // Operação não tributável
//               vBC: "0.00",
//               pCOFINS: "0.00",
//               vCOFINS: "0.00"
//             };
//           } else {
//             // Produto normal: 7.60%
//             const vCOFINS = roundTo(VrCalculado * 0.076, 2);

//             cofinsData = {
//               CST: "01",  // Operação tributável
//               vBC: VrCalculado.toFixed(2),
//               pCOFINS: "7.60",
//               vCOFINS: vCOFINS.toFixed(2)
//             }

//             // Acumular total de COFINS
//             v_TotCofins += vCOFINS;
//           }
//         }

//         // ===== 6. CALCULAR IBS/CBS (REFORMA TRIBUTÁRIA) - IGUAL PASCAL =====
//         let ibscbsData = {};

//         if (crt !== "1") {
//           // Regime Normal

//           // IBS Estadual UF: 0.10% (igual Pascal: 0.10/100)
//           const vIBSUF = roundTo(VrCalculado * (0.10 / 100), 2);

//           // CBS Federal: 0.90% (igual Pascal: 0.90/100)
//           const vCBS = roundTo(VrCalculado * (0.90 / 100), 2);

//           ibscbsData = {
//             CST: "000",
//             cClassTrib: "000001",
//             gIBSCBS: {
//               vBC: VrCalculado.toFixed(2),
//               gIBSUF: {
//                 pIBSUF: "0.10",
//                 vIBSUF: vIBSUF.toFixed(2)
//               },
//               gIBSMun: {
//                 pIBSMun: "0.00",
//                 vIBSMun: "0.00"
//               },
//               vIBS: vIBSUF.toFixed(2),
//               gCBS: {
//                 pCBS: "0.90",
//                 vCBS: vCBS.toFixed(2)
//               }
//             }
//           };

//           // Acumular totais IBS/CBS
//           v_TotIBSUF += vIBSUF;
//           v_TotCBS += vCBS;
//         }

//         // ===== 7. APLICAR IMPOSTOS DO ITEM =====
//         NFe.tagProdICMS(index, icmsData);
//         NFe.tagProdPIS(index, pisData);
//         NFe.tagProdCOFINS(index, cofinsData);
//         NFe.tagProdIBSCBS(index, ibscbsData);
//       });


//       // ===== TOTALIZAR NOTA (APÓS PROCESSAR TODOS OS ITENS) =====
//       const crtFinal = String(vendaData.data[0]?.venda.NFE_INFNFE_EMIT_CRT || "3");

//       const totaisFinais = {
//         ICMSTot: {
//           vBC: (crtFinal === "1") ? "0.00" : V_ICMSTot_vNF.toFixed(2),
//           vICMS: v_TotICMS.toFixed(2),
//           vICMSDeson: "0.00",
//           vFCP: "0.00",
//           vBCST: "0.00",
//           vST: "0.00",
//           vFCPST: "0.00",
//           vFCPSTRet: "0.00",
//           vProd: (V_ICMSTot_vNF + V_Tot_Desconto).toFixed(2),
//           vFrete: "0.00",
//           vSeg: "0.00",
//           vDesc: V_Tot_Desconto.toFixed(2),
//           vII: "0.00",
//           vIPI: "0.00",
//           vIPIDevol: "0.00",
//           vPIS: v_TotPis.toFixed(2),
//           vCOFINS: v_TotCofins.toFixed(2),
//           vOutro: "0.00",
//           vNF: V_ICMSTot_vNF.toFixed(2)
//         },
//         IBSCBSTot: {
//           vBCIBSCBS: V_ICMSTot_vNF.toFixed(2),
//           gIBS: {
//             gIBSUF: {
//               vDif: "0.00",
//               vDevTrib: "0.00",
//               vIBSUF: v_TotIBSUF.toFixed(2)
//             },
//             gIBSMun: {
//               vDif: "0.00",
//               vDevTrib: "0.00",
//               vIBSMun: "0.00"
//             },
//             vIBS: (v_TotIBSUF + 0).toFixed(2),
//             vCredPres: "0.00",
//             vCredPresCondSus: "0.00"
//           },
//           gCBS: {
//             vDif: "0.00",
//             vDevTrib: "0.00",
//             vCBS: v_TotCBS.toFixed(2),
//             vCredPres: "0.00",
//             vCredPresCondSus: "0.00"
//           }
//         },
//         vNFTot: V_ICMSTot_vNF.toFixed(2)
//       };

//       NFe.tagTotal(totaisFinais);

    
//       // ===== LEI DA TRANSPARÊNCIA (IBPT) - APÓS O LOOP =====
//       const OlhoImposto_Fed = roundTo(V_ICMSTot_vNF * 0.2524, 2);  // 25.24% Federal
//       const OlhoImposto_UF = roundTo(V_ICMSTot_vNF * 0.1941, 2);   // 19.41% Estadual
//       const enderecoProconDF = `PROCON - DF - 151;SCS, QD. 08, BL. B-60, SALA 240, VENANCIO 2000`;
//       const enderecoProconGO = `PROCON - 151;Rua 8, N . 242 QD. 5, LT. 36, St. Central, Goiania - GO`;

//       const uf = vendaData.data[0]?.venda.NFE_INFNFE_EMIT_ENDEREMIT_UF || "SP";
//       const enderecoProcon = uf === "GO" ? enderecoProconGO : uf === "DF" ? enderecoProconDF : "";

//       const idVendaInfo = vendaData.data[0]?.venda.IDVENDA || idVenda;
//       const infCpl = `Voce pagou aproximadamente ${OlhoImposto_Fed.toFixed(2).replace('.', ',')} tributos federais ` +
//         `${OlhoImposto_UF.toFixed(2).replace('.', ',')} tributos estaduais ` +
//         `0,00 tributos municipais Fonte IBPT FECOMERCIO RS Xe67Eq ` +
//         (enderecoProcon ? `${enderecoProcon} ` : '') +
//         `Numero VENDA ${idVendaInfo} ` +
//         `PRAZO DE TROCA VALIDO POR 30 DIAS`;

//       NFe.tagTransp({
//         modFrete: payload.transp.modFrete
//       })

//       const pagamentosFormatados = Array.isArray(payload.pag.detPag)
//         ? payload.pag.detPag.map((p, idx) => {
//           const pag = {
//             indPag: 0, // 0=Pagamento à Vista
//             tPag: p.tPag,
//             vPag: p.vPag
//           };

//           // Adicionar xPag (descrição) APENAS quando tPag = "99" (Outros)
//           // if (p.tPag === "99") {
//           //   pag.xPag = "Outros";
//           // }


//           return pag;
//         })
//         : [{ indPag: 0, tPag: "01", vPag: "0.00" }];

//       NFe.tagDetPag(pagamentosFormatados);

//       // Calcular troco (diferença entre valor pago e valor da nota)
//       const totalPago = pagamentosFormatados.reduce((sum, p) => sum + parseFloat(p.vPag), 0);
//       const vrTroco = roundTo(totalPago - parseFloat(totaisFinais.vNFTot), 2);
//       console.log(vrTroco, '<-- Valor do Troco');
//       // if (vrTroco > 0) {
//       // }
//       NFe.tagTroco(vrTroco.toFixed(2));

//       NFe.tagInfAdic({
//         infCpl: infCpl,
//       })

//       const xmlGerado = NFe.xml();

//       tools.xmlSign(xmlGerado).then(async xmlSign => {
//         // xmlSign já é a string XML assinada
//         fs.writeFileSync(`./xml-nfe/nfe${idVenda}.xml`, xmlSign, { encoding: "utf-8" });
//         console.log("✅ XML assinado e salvo com UTF-8. Tamanho:", xmlSign.length);
        
//         tools.sefazEnviaLote(xmlSign).then(consulta => {
//           console.log("✅ Consulta NFe realizada com sucesso.");
//           // consulta já é a string XML de resposta
//           if (consulta && typeof consulta === 'string') {
//             fs.writeFileSync(`./xml-consulta/consulta_nfe${idVenda}.xml`, consulta, { encoding: "utf-8" });
//             console.log("✅ XML de consulta salvo com UTF-8. Tamanho:", consulta.length);
//           } else {
//             console.warn("⚠️ Resposta da SEFAZ inválida ou vazia:", consulta);
//           }
          
//         }).catch(errCons => {
//           console.error("   Stack:", errCons);

//         } );
//       }).catch(errSign => {
//         console.error("❌ Erro em xmlSign:");
//         console.error("   Mensagem:", errSign.message);
//         console.error("   Stack:", errSign.stack);
//       });

//       // Retornar dados completos incluindo XML gerado
//       return res.json({
//         venda: vendaData,

//       });
//     } catch (error) {
//       console.error('Erro ao consultar venda ou gerar XML:', error);
//       return res.status(500).json({ error: 'Erro ao consultar venda ou gerar XML', details: error.message });
//     }
//   }
// }

// export default new ConsultaNFeController();