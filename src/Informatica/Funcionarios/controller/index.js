import { FuncionarioClient } from '../../Clients/FuncionarioClient.js';
import { FuncionarioService } from '../../Services/FuncionarioService.js';
import funcionarioSchema from '../schema/index.js';
import { inativarFuncionarioSchema } from '../schema/funcionarioInativarSchema.js';
const funcionarioClient = new FuncionarioClient(process.env.INFORMATICA_API_URL);
const funcionarioService = new FuncionarioService(funcionarioClient);



export class FuncionarioController {
  async putFuncionarioLoja(req, res) {
    try {
      const { error, value } = funcionarioSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return res.status(400).json({
          message: 'Dados inválidos',
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
      }

      const response = await funcionarioService.updateFuncionario(
        value.IDFUNCIONARIO,
        value.IDSUBGRUPOEMPRESARIAL,
        value.NOFUNCIONARIO,
        value.NUCPF,
        value.PWSENHA,
        value.DSTIPO,
        value.DTADMISSAO,
        value.IDPERFIL,
        value.DSFUNCAO,
        value.STCONVENIO,
        value.STDESCONTOFOLHA,
        value.STLOJA,
        value.STATIVO,
        value.IDFUNCALTERACAO,
        value.MOTIVODESC,
        value.ID
      );

      return res.status(200).json(response);
    } catch (error) {
      console.error("Erro no FuncionarioController.putFuncionarioLoja:", error);
      return res.status(500).json({ error: "Erro no servidor" });
    }
  }

  async postFuncionarioLoja(req, res) {
    try {
      const { error, value } = funcionarioSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return res.status(400).json({
          message: 'Dados inválidos',
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
      }

      const response = await funcionarioService.createFuncionario(
        value.IDFUNCIONARIO,
        value.IDSUBGRUPOEMPRESARIAL,
        value.NOFUNCIONARIO,
        value.NUCPF,
        value.PWSENHA,
        value.DSTIPO,
        value.DTADMISSAO,
        value.IDPERFIL,
        value.DSFUNCAO,
        value.STCONVENIO,
        value.STDESCONTOFOLHA,
        value.STLOJA,
        value.STATIVO,
        value.IDFUNCALTERACAO,
        value.MOTIVODESC,
        value.ID
      );

      return res.status(201).json(response);
    } catch (error) {
      console.error("Erro no FuncionarioController.postFuncionarioLoja:", error);
      return res.status(500).json({ error: "Erro no servidor" });
    }
  }

  async putInativarFuncionario(req, res) {
    try {
      const { error, value } = inativarFuncionarioSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: error.details.map(detail => ({
            field: detail.path.join("."),
            message: detail.message
          }))
        });
      }

      const response = await funcionarioService.inativarFuncionario(
        value.DATAULTIMAALTERACAO,
        value.STATIVO,
        value.DATA_DEMISSAO,
        value.ID
      );

      return res.status(200).json(response);
    } catch (error) {
      console.error("Erro no FuncionarioController.inativarFuncionario:", error);
      return res.status(500).json({ error: "Erro no servidor" });
    }
  }


}




export default new FuncionarioController();







