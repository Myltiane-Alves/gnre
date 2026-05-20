import axios from 'axios';
import 'dotenv/config';
const url = process.env.API_URL;

export class RelatorioBiClient {

        constructor(baseURL) {
            this.api = axios.create({
                baseURL: baseURL || url, 
                timeout: 80000
            });
        }

        async criarRelatorioBi(
            DSRELATORIOBI,
            STATIVO
        ) {
            const response = await this.api.post(`${url}/api/informatica/relatoriobi.xsjs`, [{
                DSRELATORIOBI,
                STATIVO
            }])
            return response.data;
        }


        async atualizarRelatorioBi(      
            DSRELATORIOBI,
            STATIVO,
            IDRELATORIOBI
        ) {
            const response = await this.api.put(`${url}/api/informatica/relatoriobi.xsjs`, [{
                DSRELATORIOBI,
                STATIVO,
                IDRELATORIOBI
            }])
            return response.data;

        }

}