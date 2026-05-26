import { Router } from 'express';

import ConsultaStatusNfeController from './Informatica/ConsultaNFCE/controllers/statusNfce.js'
import ConsultaNfeController from './Informatica/ConsultaNFCE/controllers/consulta.js'
import GnreProcessoController from './Informatica/ConsultaNFCE/controllers/gnreProcesso.js'
import GnreController from './Informatica/ConsultaNFCE/controllers/index.js'
import GnrePhpMirrorController from './Informatica/ConsultaNFCE/controllers/gnrePhpMirrorController.js'
// import Teste from './Informatica/ConsultaNFCE/controllers/testet.js'
import GNRE from './Informatica/ConsultaNFCE/controllers/gnre.js'
// const teste = new Teste();

const gnre = new GnreController();
const routes = new Router();
// routes.use(authMiddleware)

routes.get('/', (req, res) => {
    res.send('Hello World! Myltiane');
});

routes.post(
    '/gnre',
    async (req, res) => {

        try {

            const gnre = new GNRE();

            /*
                ENVIO GNRE
            */
            const retornoEnvio =
                await gnre.enviarParaSefaz(
                    req.body
                );

            if (!retornoEnvio.success) {

                return res.status(400).json(
                    retornoEnvio
                );

            }

            /*
                RECIBO
            */
            const numeroRecibo =
                retornoEnvio?.jsonResposta
                ?.['soap:Envelope']
                ?.['soap:Body']
                ?.processarResponse
                ?.processarResult
                ?.recibo;

            let consulta = null;

            /*
                CONSULTA LOTE
            */
            if (numeroRecibo) {

                consulta =
                    await gnre.consultarLote(
                        numeroRecibo
                    );

            }

            return res.json({
                envio: retornoEnvio,
                consulta
            });

        } catch (error) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

    }
);

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

export default routes;

