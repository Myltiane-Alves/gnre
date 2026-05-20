import { Router } from 'express';
import InformaticaControllers  from '../controllers/Informatica.js';


const routes = new Router();

routes.get('/marcasLista', InformaticaControllers.getListaMarcas)
routes.get('/listaGrupoEmpresas', InformaticaControllers.getListaGrupoEmpresas)
routes.get('/listaEmpresasControleTransferencia', InformaticaControllers.getListaEmpresas);
routes.get('/listaEmpresasIformatica', InformaticaControllers.getListaEmpresasInformatica);
routes.get('/listaProdutoPreco', InformaticaControllers.getListaProdutoPreco)
routes.get('/lista-caixas', InformaticaControllers.getListaCaixas)
// routes.get('/listaCaixasID', InformaticaControllers.getListaCaixasID)
routes.get('/atualiza-empresa-diario', InformaticaControllers.getListaAtualizaEmpresaDiario)
routes.get('/vendas-loja-informatica', InformaticaControllers.getListaVendasLojaInformatica)
routes.get('/funcionarios-loja', InformaticaControllers.getListaFuncionariosLoja)
routes.get('/atualizarFuncionario', InformaticaControllers.getListaAtualizarFuncionario)
routes.get('/pagamento-tef-informatica', InformaticaControllers.getListaPagamentoTEFInformatica)
routes.get('/pagamento-pos-informatica', InformaticaControllers.getListaPagamentoPOSInformatica)

routes.get('/vendas-alloc', InformaticaControllers.getListaVendasAlloc)
routes.get('/vendas-contigencia', InformaticaControllers.getListaVendasContigenciaIformatica)
routes.get('/lista-cliente', InformaticaControllers.getListaClienteIformatica)
// routes.get('/listaClienteID', InformaticaControllers.getListaCliente)
routes.get('/linkRelatorioBI', InformaticaControllers.getListaLinkRelatorioBI)
routes.get('/relatorioInformaticaBI', InformaticaControllers.getListaRelatorioBI)
routes.get('/lista-cliente-credsystem', InformaticaControllers.getListaCadastroClienteCredSystem)
routes.get('/lista-meio-pagamento-credsystem', InformaticaControllers.getListaMeioPagamentoCredSystem)
routes.get('/lista-parceria-credsystem', InformaticaControllers.getListaParceriaCredSystem)

// POST

routes.post('/configuracao-todos', InformaticaControllers.postCaixaLoja)
routes.post('/criar-lista-caixas', InformaticaControllers.postConfiguracao)

// PUT
routes.put('/inativar-funcionario', InformaticaControllers.putInativarFuncionario)
routes.put('/relatorioInformaticaBI/:id', InformaticaControllers.putRelatorioBI)

// routes.put('/atualizaStatusCaixa', InformaticaControllers.updateAtualizaSTCaixasInformatica)
routes.put('/funcionarios-loja/:id', InformaticaControllers.putFuncionarioLoja)
routes.post('/funcionarios-loja', InformaticaControllers.postFuncionarioLoja)
routes.put('/lista-caixas/:id', InformaticaControllers.putCaixaLoja)
routes.put('/funcionarios-desconto/:id', InformaticaControllers.putFuncionarioDesconto)

// routes.put('/configuracao-todos/:id', InformaticaControllers.putCaixaLoja)

export default routes;