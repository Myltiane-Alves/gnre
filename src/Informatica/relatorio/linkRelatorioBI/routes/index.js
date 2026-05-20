import { Router } from "express";
//import LinkRelatorioBiController from '../controller/controllersLinkRelatorioBi'

const routes = new Router();

routes.post('/criarlinkRelatorioBI', LinkRelatorioBiController.postLinkRelatorioBi)
routes.put('/linkRelatorioBI/:id', LinkRelatorioBiController.postLinkRelatorioBi)


export default routes;