import { Router } from 'express';

import ConsultaStatusNfeController from './Informatica/ConsultaNFCE/controllers/statusNfce.js'
import ConsultaNfeController from './Informatica/ConsultaNFCE/controllers/consulta.js'
import GnreProcessoController from './Informatica/ConsultaNFCE/controllers/gnreProcesso.js'


const routes = new Router();
// routes.use(authMiddleware)

routes.get('/', (req, res) => {
    res.send('Hello World! Myltiane');
});


// Início Informática GET

// routes.post('/consulta-nfec', ConsultaNfeController.consultar)
// routes.get('/valida-venda-contingencia', ConsultaNfeController.getListaVendasContigenciaValidas);
routes.put('/valida-venda-contingencia/:id', ConsultaNfeController.putValidarVendaContigencia);
routes.post('/gnre/processar', GnreProcessoController.processar);
routes.post('/gnre/pdf', GnreProcessoController.gerarPdf);
// routes.get('/gerar-pfx', ConsultaStatusNfeController.gerarPFX);
// routes.post('/consultar-nfce', ConsultaNFceController.consultaNFce);
// routes.post('/downloadXML', ConsultaStatusNfeController.downloadNFE);
// routes.post('/cancelar-nfe', ConsultaStatusNfeController.cancelarNFE);
// routes.post('/inutilizar-nfe', ConsultaStatusNfeController.inutilizarNFE);
routes.get('/validarConsulta', ConsultaStatusNfeController.validarConsulta);
// routes.post('/consultar-nfe', ConsultaNFeController.consultaNFe);
// Adicionando rota para consultar GNRE
routes.get('/gnre/consulta', GnreProcessoController.consultarGnre);


export default routes;

