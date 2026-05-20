import { Router } from 'express';
import InformaticaControllers from '../../../../src/Informatica/controllers/Informatica.js';

const routes = new Router();

routes.post('/criarlinkRelatorioBI', InformaticaControllers.postLinkRelatorioBI)

export default routes;