import { RelatorioBiClient } from "../client/index.js";
import { putRelatorioBiSchema } from "../schema/putSchemaRelatorioBi.js";
import { relatorioBiSchema } from "../schema/schemaRelatorioBi.js"
import { RelatorioServices } from "../services/index.js"

const relatorioBiClient = new RelatorioBiClient(process.env.API_URL);
const relatorioServices = new RelatorioServices(relatorioBiClient);

class RelatorioBIController {
    async postRelatorioBi(req, res) {

        try {
            const { error, value } = relatorioBiSchema.validate(req.body, {
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
            const response = await relatorioServices.createRelatorioBi({
                DSRELATORIOBI: value.DSRELATORIOBI,
                STATIVO: value.STATIVO,
            });
            return res.status(200).json(response);

        } catch (error) {
            console.error("Erro no RelatorioBIController.postRelatorioBi:", error);
            return res.status(500).json({ error: 'Erro no servidor' });
        }

    }

    async putRelatorioBi(req, res) {
        try {
            const { error, value } = putRelatorioBiSchema.validate(req.body, {
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

            const response = await relatorioServices.updateRelatorioBi({
                DSRELATORIOBI: value.DSRELATORIOBI,
                STATIVO: value.STATIVO,
                IDRELATORIOBI: value.IDRELATORIOBI
            });
            return res.status(200).json(response);

        } catch (error) {
            console.error('Erro no RelatorioBiController.putRelatorioBi:', error);
            return res.status(500).json({ error: 'Erro no Servidor' })

        }
    }

}

export default new RelatorioBIController();