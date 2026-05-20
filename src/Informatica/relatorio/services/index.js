export class RelatorioService {

    constructor(client){
        this.client = client;
    }

    async criarLinkRelatorioBI(IDRELATORIOBI, IDEMPRESA, LINK, STATIVO){
        if(!IDRELATORIOBI){
            throw new Error('ID do Relatorio BI é obrigatorio')
        }
        if(!IDEMPRESA){
            throw new Error('ID da empresa é obrigatorio')
        }
        if(!LINK){
            throw new Error('Link do Relatorio BI é obrigatorio')
        }
        if(STATIVO){
            throw new Error('Status do Relatorio BI é obrigatorio')
        }

        const result = await this.client.criarLinkRelatoioBI(
            IDRELATORIOBI,
            IDEMPRESA,
            LINK, 
            STATIVO
            );

        return result;
    }
}

