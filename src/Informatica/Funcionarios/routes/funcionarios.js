import { Router } from 'express';
import FuncionarioController from "../controller/index"

const routes = new Router();

routes.put('/funcionarios-loja/:id', FuncionarioController.putFuncionarioLoja)
routes.post('/criar-funcionarios-loja', FuncionarioController.postFuncionarioLoja)
routes.put('/inativar-funcionario', FuncionarioController.putInativarFuncionario)

export default routes;