// import fs from 'fs';
// import path from 'path';
// import axios from 'axios';
// const url = process.env.API_URL;
// export async function getCertOptions(senha, fallbackPfxPath = './GTO COMERCIO 2025-2026.pfx') {
//   // -----------------------------
//   // 1) PFX BASE64 VIA ENV
//   // -----------------------------
//   if (process.env.CERT_PFX_BASE64) {
//     try {
//       const buf = Buffer.from(process.env.CERT_PFX_BASE64, "base64");
//       if (buf.length > 0) {
//         return { pfx: buf, senha };
//       }
//     } catch (e) {
//       console.error("ERRO: CERT_PFX_BASE64 inválido:", e.message);
//     }
//   }

//   // -----------------------------
//   // 2) PFX ARQUIVO LOCAL
//   // -----------------------------
//   if (fallbackPfxPath && fs.existsSync(fallbackPfxPath)) {
//     try {
//       const buf = fs.readFileSync(path.resolve(fallbackPfxPath));
//       if (buf.length > 0) {
//         return { pfx: buf, senha };
//       }
//     } catch (e) {
//       console.error("ERRO ao ler arquivo PFX local:", e.message);
//     }
//   }

//   // -----------------------------
//   // 3) PEM BASE64 (cert + key)
//   // -----------------------------
//   if (process.env.CERT_PEM_CERT_BASE64 && process.env.CERT_PEM_KEY_BASE64) {
//     try {
//       const cert = Buffer.from(process.env.CERT_PEM_CERT_BASE64, "base64");
//       const key = Buffer.from(process.env.CERT_PEM_KEY_BASE64, "base64");
//       return { cert, key };
//     } catch (e) {
//       console.error("ERRO: CERT_PEM_*_BASE64 inválido:", e.message);
//     }
//   }

//   // -----------------------------
//   // 4) PEM POR CAMINHO
//   // -----------------------------
//   if (process.env.CERT_PEM_CERT_PATH && process.env.CERT_PEM_KEY_PATH) {
//     try {
//       const cert = fs.readFileSync(process.env.CERT_PEM_CERT_PATH);
//       const key = fs.readFileSync(process.env.CERT_PEM_KEY_PATH);
//       return { cert, key };
//     } catch (e) {
//       console.error("ERRO ao ler caminhos PEM:", e.message);
//     }
//   }

//   // -----------------------------
//   // 5) NADA ENCONTRADO
//   // -----------------------------
//   return null;
// }

// class SoapController {
//    async consultaSefaz(req, res) {
//     try {
//       const { idVenda } = req.query;

//       function ufToCodigo(uf) {
//         const map = {
//           RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
//           MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
//           SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35",
//           PR: "41", SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53"
//         };
//         return map[uf?.toUpperCase()] || "35";
//       }

//       // ================== 1. BUSCAR VENDA ==================
//       const response = await axios.get(
//         `${url}/api/venda/lista-venda-new-xml.xsjs?id=${idVenda}`
//       );

//       const vendaApi = response.data.data[0];
//       const venda = vendaApi.venda;
//       const itens = vendaApi.detalhe;
//       const pagamentos = vendaApi.pagamento;
//       const config = vendaApi.configuracao[0].config;

//       // ================== 2. CHAVE ==================
//       const chave = venda.CHAVE.replace(/^NFe/, "");
//       if (!/^\d{44}$/.test(chave)) {
//         throw new Error(`Chave inválida: ${chave}`);
//       }

//       // ================== 3. DATA ==================
//       let dhEmi = venda.NFE_INFNFE_IDE_DHEMI;
//       if (!dhEmi.includes("T")) {
//         const agora = new Date();
//         dhEmi = `${dhEmi}T${agora.toTimeString().substring(0, 8)}-03:00`;
//       }

//       // ================== 4. CERTIFICADO ==================
//       const SENHA_CERT = process.env.SENHA || "#senhagto2024#";
//       const certOptions = await getCertOptions(
//         SENHA_CERT,
//         "./GTO COMERCIO 2025-2026.pfx"
//       );
//       const opensslModulesPath = path.resolve("./libs/openssl/lib/ossl-modules");
//       process.env.OPENSSL_MODULES = opensslModulesPath;

//       // ================== 5. TOOLS ==================
//       const tools = new Tools(
//         {
//           mod: "65",
//           tpAmb: 2,
//           UF: 'DF',
//           versao: "4.00",
//           CSC: config.TOKENCSC,
//           CSCid: config.IDTOKEN,
//           timeout: 60,
//           xmllint: path.resolve("./libs/libxml/bin/xmllint.exe"),
//           openssl: path.resolve("./libs/openssl/bin/openssl.exe"),
//         },
//         certOptions
//       );

//       // ================== 6. MONTAR XML (MAKE) ==================
//       const NFe = new Make();

//       // 👉 Pode ser null OU NFe + chave (ambos funcionam)
//       NFe.tagInfNFe({ Id: `NFe${chave}`, versao: "4.00" });

//       NFe.tagIde({
//         cUF: ufToCodigo(venda.NFE_INFNFE_EMIT_ENDEREMIT_UF),
//         cNF: venda.NFE_INFNFE_IDE_CNF,
//         natOp: venda.NFE_INFNFE_IDE_NATOP,
//         mod: "65",
//         serie: String(venda.NFE_INFNFE_IDE_SERIE).padStart(3, "0"),
//         nNF: venda.NFE_INFNFE_IDE_NNF,
//         dhEmi,
//         tpNF: "1",
//         idDest: "1",
//         cMunFG: venda.NFE_INFNFE_IDE_CMUNFG,
//         tpImp: "4",
//         tpEmis: "1",
//         cDV: venda.NFE_INFNFE_IDE_CDV,
//         tpAmb: "2",
//         finNFe: "1",
//         indFinal: "1",
//         indPres: "1",
//         indIntermed: "0",
//         procEmi: "0",
//         verProc: "1.0.0",
//       });

//       NFe.tagEmit({
//         CNPJ: venda.NFE_INFNFE_EMIT_CNPJ,
//         xNome: venda.NFE_INFNFE_EMIT_NOME,
//         xFant: venda.NFE_INFNFE_EMIT_FANT,
//         IE: venda.NFE_INFNFE_EMIT_IE,
//         CRT: venda.NFE_INFNFE_EMIT_CRT,
//       });

//       NFe.tagEnderEmit({
//         xLgr: venda.NFE_INFNFE_EMIT_ENDEREMIT_XLGR,
//         nro: venda.NFE_INFNFE_EMIT_ENDEREMIT_NRO,
//         xBairro: venda.NFE_INFNFE_EMIT_ENDEREMIT_XBAIRRO,
//         cMun: venda.NFE_INFNFE_EMIT_ENDEREMIT_CMUN,
//         xMun: venda.NFE_INFNFE_EMIT_ENDEREMIT_XMUN,
//         UF: venda.NFE_INFNFE_EMIT_ENDEREMIT_UF,
//         CEP: venda.NFE_INFNFE_EMIT_ENDEREMIT_CEP,
//         cPais: venda.NFE_INFNFE_EMIT_ENDEREMIT_CPAIS,
//         xPais: venda.NFE_INFNFE_EMIT_ENDEREMIT_XPAIS,
//       });

//       // ================== PRODUTOS ==================
//       // Função auxiliar para formatar valores decimais com precisão máxima de 2 casas
//       const formatDecimal = (value, decimals = 2) => {
//         if (value === null || value === undefined || value === "") {
//           return decimals === 2 ? 0.00 : 0.0000;
//         }
//         // Remove qualquer formatação anterior, converte e formata
//         const strValue = String(value).trim();
//         const num = parseFloat(strValue);
//         if (isNaN(num)) {
//           return decimals === 2 ? 0.00 : 0.0000;
//         }
//         // Retorna como NÚMERO para a biblioteca processar corretamente
//         return parseFloat(num.toFixed(decimals));
//       };

//       NFe.tagProd(
//         itens.map(item => ({
//           cProd: item.det.CPROD,
//           cEAN: item.det.CEAN,
//           xProd: item.det.XPROD,
//           NCM: item.det.NCM,
//           CFOP: item.det.CFOP,
//           uCom: item.det.UCOM,
//           qCom: formatDecimal(item.det.QCOM, 4),
//           vUnCom: formatDecimal(item.det.VUNCOM),
//           vProd: formatDecimal(item.det.VPROD),
//           cEANTrib: item.det.CEANTRIB,
//           uTrib: item.det.UTRIB,
//           qTrib: formatDecimal(item.det.QTRIB, 4),
//           vUnTrib: formatDecimal(item.det.VUNTRIB),
//           indTot: "1",
//         }))
//       );

//       itens.forEach((item, index) => {
//         NFe.tagProdICMS(index, {
//           orig: item.det.ICMS_ORIG,
//           CST: item.det.ICMS_CST,
//           modBC: item.det.ICMS_MODBC,
//           vBC: formatDecimal(item.det.ICMS_VBC),
//           pICMS: formatDecimal(item.det.ICMS_PICMS),
//           vICMS: formatDecimal(item.det.ICMS_VICMS),
//         });

//         NFe.tagProdPIS(index, {
//           CST: item.det.PIS_CST,
//           vBC: formatDecimal(item.det.PIS_VBC),
//           pPIS: formatDecimal(item.det.PIS_PPIS),
//           vPIS: formatDecimal(item.det.PIS_VPIS),
//         });

//         NFe.tagProdCOFINS(index, {
//           CST: item.det.COFINS_CST,
//           vBC: formatDecimal(item.det.COFINS_VBC),
//           pCOFINS: formatDecimal(item.det.COFINS_PCOFINS),
//           vCOFINS: formatDecimal(item.det.COFINS_VCOFINS),
//         });
//       });

//       // ================== TOTAL / PAGAMENTO ==================
//       NFe.tagTotal();
//       NFe.tagTransp({ modFrete: "9" });

//       NFe.tagDetPag(
//         pagamentos.map(p => ({
//           indPag: "0",
//           tPag: p.pag.TPAG, // ex: 01, 03, 04, 17
//           vPag: formatDecimal(p.pag.VALORRECEBIDO),
//         }))
//       );


//       // tools.sefazStatus()
//       //   .then(res => console.log('STATUS SEFAZ:', res))
//       //   .catch(err => console.error('ERRO STATUS:', err));
     
//       fs.writeFileSync("xmls/nfe.xml", NFe.xml(), { encoding: "utf-8" });

//       // ================== 7. GERAR / ASSINAR / ENVIAR ==================
//       const xmlBase = NFe.xml();

//       // Garantir que o XML base tenha UTF-8
//       let xmlBaseUtf8 = xmlBase;
//       if (!xmlBaseUtf8.includes('encoding="UTF-8"')) {
//         xmlBaseUtf8 = xmlBaseUtf8.replace(
//           /^<\?xml[^>]*\?>/,
//           '<?xml version="1.0" encoding="UTF-8"?>'
//         );
//       }

//       console.log("✅ XML gerado com UTF-8. Tamanho:", xmlBaseUtf8.length);

//       const xmlAssinado = await tools.xmlSign(xmlBaseUtf8);

//       // Garantir que o XML assinado também tenha UTF-8
//       let xmlAssinadoUtf8 = xmlAssinado;
//       if (!xmlAssinadoUtf8.includes('encoding="UTF-8"')) {
//         xmlAssinadoUtf8 = xmlAssinadoUtf8.replace(
//           /^<\?xml[^>]*\?>/,
//           '<?xml version="1.0" encoding="UTF-8"?>'
//         );
//       }

//       console.log("✅ XML assinado com UTF-8. Tamanho:", xmlAssinadoUtf8);

//       // const resposta = await tools.sefazEnviaLote(xmlAssinadoUtf8, { indSinc: 1 });
//       // console.log(resposta, 'RESPOSTA SEFAZ');
//       return res.json({
//         sucesso: true,
//         // resposta,
//       });

//     } catch (error) {
//       console.error(error);
//       return res.status(500).json({
//         sucesso: false,
//         erro: error.message,
//       });
//     }
//   }
  
// }

// export default new SoapController();