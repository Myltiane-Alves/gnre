import { Router } from 'express';
//import RelatorioBIController from '../controller/controllerRelatorioBi';

const routes = new Router();

routes.post('/createRelatorioInformaticaBI', RelatorioBIController.postRelatorioBi)
routes.put('/relatorioInformaticaBI/:id',  RelatorioBIController.putRelatorioBi)


export default routes
