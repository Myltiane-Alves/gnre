export class linkRelatorioBIService {
    constructor(client) {
        this.client = client;
    }

    async createLinkRelatorioBi({
        IDRELATORIOBI,
        IDEMPRESA,
        LINK,
        STATIVO
    }) {

        if (!IDRELATORIOBI) {
            throw new Error('IDRELATORIOBI obrigatorio');
        }
        if (!IDEMPRESA) {
            throw new Error('IDEMPRESA obrigatorio');
        }
        if (!LINK) {
            throw new Error('LINK obrigatorio');
        }
        if (!STATIVO) {
            throw new Error('STATIVO obrigatorio');
        }

        const result = await this.client.criarLinkRelatoioBI(
            IDRELATORIOBI,
            IDEMPRESA,
            LINK,
            STATIVO
        );
        return result
    }

    async updateLinkRelatorioBi({
        IDRELATORIOBI,
        IDEMPRESA,
        LINK,
        STATIVO,
        IDRELATORIOBIANTIGO
    }) {
        
        if (!IDRELATORIOBI) {
            throw new Error('IDRELATORIOBI obrigatorio ');
        }
        if (!IDEMPRESA) {
            throw new Error('IDEMPRESA obrigatorio');
        }
        if (!LINK) {
            throw new Error('LINK obrigatorio');
        }
        if (!STATIVO) {
            throw new Error('STATIVO obrigatorio');
        }
        if (!IDRELATORIOBIANTIGO) {
            throw new Error('IDRELATORIOBIANTIGO obrigatorio');
        }

        const result = await this.client.atualizarLinkRelatoioBI(
            IDRELATORIOBI,
            IDEMPRESA,
            LINK,
            STATIVO,
            IDRELATORIOBIANTIGO
        );
        return result
    }
}