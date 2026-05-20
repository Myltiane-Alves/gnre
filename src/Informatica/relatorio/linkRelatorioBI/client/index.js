import axios from 'axios';
import 'dotenv/config';
const url = process.env.API_URL;

export class LinkRelatorioBiClient {
    constructor(baseURL) {
        this.api = axios.create({
            baseURL: baseURL || url,
            timeout: 80000
        });
    }

    async criarLinkRelatoioBI(IDRELATORIOBI, IDEMPRESA, LINK, STATIVO) {
        const response = await this.api.post(`${url}/api/informatica/linkrelatoriobi.xsjs`, {
            IDRELATORIOBI,
            IDEMPRESA,
            LINK,
            STATIVO
        })

        return response.data

    }

    async atualizarLinkRelatoioBI(IDRELATORIOBI, IDEMPRESA, LINK, STATIVO, IDRELATORIOBIANTIGO) {
        const response = await this.api.put(`${url}/api/informatica/linkrelatoriobi.xsjs`, {
            IDRELATORIOBI,
            IDEMPRESA,
            LINK,
            STATIVO,
            IDRELATORIOBIANTIGO
        })
        return response.data
    }

}
