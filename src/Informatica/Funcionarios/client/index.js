import axios from 'axios';
import 'dotenv/config';
const url = process.env.API_URL;

export class FuncionarioClient {
    constructor(baseURL) {
        this.api = axios.create({
            baseURL: baseURL || url,
            timeout: 80000
        });
    }
        
    async atualizarFuncionario(IDFUNCIONARIO, IDSUBGRUPOEMPRESARIAL, NOFUNCIONARIO, NUCPF, PWSENHA, DSTIPO, DTADMISSAO, IDPERFIL, DSFUNCAO, STCONVENIO, STDESCONTOFOLHA, STLOJA, STATIVO, IDFUNCALTERACAO, MOTIVODESC, ID) {
        const response = await this.api.put(`/api/informatica/funcionario-loja.xsjs`, {
            IDFUNCIONARIO,
            IDSUBGRUPOEMPRESARIAL,
            NOFUNCIONARIO,
            NUCPF,
            PWSENHA,
            DSTIPO,
            DTADMISSAO,
            IDPERFIL,
            DSFUNCAO,
            STCONVENIO,
            STDESCONTOFOLHA,
            STLOJA,
            STATIVO,
            IDFUNCALTERACAO,
            MOTIVODESC,
            ID
        })
        return response.data; 
    }

    async criarFuncionario(IDFUNCIONARIO, IDSUBGRUPOEMPRESARIAL, NOFUNCIONARIO, NUCPF, PWSENHA, DSTIPO, DTADMISSAO, IDPERFIL, DSFUNCAO, STCONVENIO, STDESCONTOFOLHA, STLOJA, STATIVO, IDFUNCALTERACAO, MOTIVODESC, ID) {
    const response = await this.api.post(`/api/informatica/funcionario-loja.xsjs`, { 
            IDFUNCIONARIO,
            IDSUBGRUPOEMPRESARIAL,
            NOFUNCIONARIO,
            NUCPF,
            PWSENHA,
            DSTIPO,
            DTADMISSAO,
            IDPERFIL,
            DSFUNCAO,
            STCONVENIO,
            STDESCONTOFOLHA,
            STLOJA,
            STATIVO,
            IDFUNCALTERACAO,
            MOTIVODESC,
            ID
    });
    return response.data;
  }

  async inativarFuncionario(DATAULTIMAALTERACAO, STATIVO, DATA_DEMISSAO, ID) {
  const response = await this.api.put('/inativar-funcionario', {
    DATAULTIMAALTERACAO,
    STATIVO,
    DATA_DEMISSAO,
    ID
  });
  return response.data;
}


}