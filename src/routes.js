import { Router } from 'express';

import ConsultaStatusNfeController from './Informatica/ConsultaNFCE/controllers/statusNfce.js'
import ConsultaNfeController from './Informatica/ConsultaNFCE/controllers/consulta.js'
import GnreProcessoController from './Informatica/ConsultaNFCE/controllers/gnreProcesso.js'
import GnreController from './Informatica/ConsultaNFCE/controllers/index.js'
import GnrePhpMirrorController from './Informatica/ConsultaNFCE/controllers/gnrePhpMirrorController.js'
// import Teste from './Informatica/ConsultaNFCE/controllers/testet.js'
import GNRE from './Informatica/ConsultaNFCE/controllers/gnre.js'
import vendasRoutes from '../gnre-node/routes.mjs'
// const teste = new Teste();

const gnre = new GnreController();
const routes = new Router();
// routes.use(authMiddleware)

routes.get('/', (req, res) => {
    res.send('Hello World! Myltiane');
});

routes.post('/gnre',
    async (req, res) => {

        try {

            const extrairNumeroControle16 = (obj) => {
                if (!obj || typeof obj !== 'object') {
                    return null;
                }

                for (const [chave, valor] of Object.entries(obj)) {
                    if (/numero.?controle/i.test(chave)) {
                        const digitos = String(valor ?? '').replace(/\D/g, '');
                        if (digitos) {
                            return digitos.slice(-16).padStart(16, '0');
                        }
                    }

                    if (valor && typeof valor === 'object') {
                        const encontrado = extrairNumeroControle16(valor);
                        if (encontrado) {
                            return encontrado;
                        }
                    }
                }

                return null;
            };

            const extrairValorPorRegex = (obj, regex) => {
                if (!obj || typeof obj !== 'object') {
                    return null;
                }

                for (const [chave, valor] of Object.entries(obj)) {
                    if (regex.test(chave)) {
                        const valorTexto = String(valor ?? '').trim();
                        if (valorTexto) {
                            return valorTexto;
                        }
                    }

                    if (valor && typeof valor === 'object') {
                        const encontrado = extrairValorPorRegex(valor, regex);
                        if (encontrado) {
                            return encontrado;
                        }
                    }
                }

                return null;
            };

            const extrairCodigoSituacaoLote = (obj) => {
                if (!obj || typeof obj !== 'object') {
                    return null;
                }

                for (const [chave, valor] of Object.entries(obj)) {
                    if (/situacao.?process|situacao.?recepcao/i.test(chave) && valor && typeof valor === 'object') {
                        for (const [chaveInterna, valorInterno] of Object.entries(valor)) {
                            if (/codigo/i.test(chaveInterna)) {
                                const codigo = String(valorInterno ?? '').replace(/\D/g, '');
                                if (codigo) {
                                    return codigo;
                                }
                            }
                        }
                    }

                    if (valor && typeof valor === 'object') {
                        const encontrado = extrairCodigoSituacaoLote(valor);
                        if (encontrado) {
                            return encontrado;
                        }
                    }
                }

                return null;
            };

            const aguardar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const gnre = new GNRE();
            const retornoEnvio = await gnre.enviarParaSefaz( req.body);

            if (!retornoEnvio.success) {
                return res.status(400).json(retornoEnvio);
            }

            const numeroRecibo =
                retornoEnvio?.recibo?.['ns1:numero'] ||
                retornoEnvio?.recibo?.numero ||
                retornoEnvio?.jsonResposta
                ?.['soapenv:Envelope']
                ?.['soapenv:Body']
                ?.processarResponse
                ?.['ns1:TRetLote_GNRE']
                ?.['ns1:recibo']
                ?.['ns1:numero'];

            const numeroReciboConsulta = numeroRecibo ? String(numeroRecibo).replace(/\D/g, '').slice(0, 14) : null;

            let consulta = null;

            if (numeroReciboConsulta) {
                consulta = await gnre.consultarLote(numeroReciboConsulta);
                let codigoSituacao = extrairCodigoSituacaoLote(consulta?.jsonResposta);

                // Enquanto lote estiver em processamento, tenta poucas reconsultas.
                for (let tentativa = 0; tentativa < 3 && codigoSituacao === '401'; tentativa += 1) {
                    await aguardar(2500);
                    consulta = await gnre.consultarLote(numeroReciboConsulta);
                    codigoSituacao = extrairCodigoSituacaoLote(consulta?.jsonResposta);
                }
            }

            const numeroControle16 =
                extrairNumeroControle16(consulta?.jsonResposta) ||
                (req.body?.numeroControle
                    ? String(req.body.numeroControle).replace(/\D/g, '').slice(-16).padStart(16, '0')
                    : null);

            const linhaDigitavel =
                extrairValorPorRegex(consulta?.jsonResposta, /linha.?digitavel/i) ||
                (req.body?.linhaDigitavel ? String(req.body.linhaDigitavel) : null);

            const codigoBarras =
                extrairValorPorRegex(consulta?.jsonResposta, /codigo.?barra(s)?|barra(s)?/i) ||
                (req.body?.codigoBarras ? String(req.body.codigoBarras) : null);

                   
            const pdf = await gnre.gerarPdfGnre(req.body, numeroControle16, { linhaDigitavel, codigoBarras });
            return res.json({ envio: retornoEnvio, numeroReciboConsulta, numeroControle16, consulta, pdf });

        } catch (error) {
            return res.status(500).json({success: false,message: error.message});
        }
    }
);


routes.post('/consulta-config-uf', async (req, res) => {
  try {

    const gnre = new GNRE();

    const retorno = await gnre.gerarConsultaConfigUf(req.body);

    res.type('application/xml');
    res.send(retorno);

  } catch (error) {

    res.status(500).json({
      success: false,
      erro: error.response?.data || error.message
    });

  }
});


// routes.get('/validarConsulta', GNRE.consultarLote);
routes.put('/valida-venda-contingencia/:id', ConsultaNfeController.putValidarVendaContigencia);
routes.post('/gnre/processar', GnreProcessoController.processar);
routes.post('/gnre/pdf', GnreProcessoController.gerarPdf);
routes.post('/gnre/simples', GnreProcessoController.gerarGnreSimples);
routes.get('/validarConsulta', ConsultaStatusNfeController.validarConsulta);
// routes.post('/consultar-nfe', ConsultaNFeController.consultaNFe);
// Adicionando rota para consultar GNRE
routes.get('/gnre/consulta', GnreProcessoController.consultarGnre);
routes.get('/gnre/consulta', GnreProcessoController.consultarGnre);
// routes.get('/gnre/teste', (req, res) => teste.processar());

routes.post('/gnre/gerar',      (req, res) => gnre.gerarGnre(req, res));
routes.get('/gnre/consultar',   (req, res) => gnre.consultarLote(req, res));
routes.get('/gnre/preview',     (req, res) => gnre.previewXml(req, res));
routes.get('/gnre/gerar-fixa',  (req, res) => gnre.gerarGnreFixa(req, res));

routes.post('/gnre/php-mirror/preview', GnrePhpMirrorController.preview);
routes.post('/gnre/php-mirror/enviar', GnrePhpMirrorController.enviarLote);
routes.post('/gnre/php-mirror/consultar', GnrePhpMirrorController.consultarLote);

routes.use(vendasRoutes);

export default routes;

