import axios from 'axios';
import 'dotenv/config';
const url = process.env.API_URL;

class ConsultaNfeController {
  async putValidarVendaContigencia(req, res) {
    try {
      let { IDVENDA, page, pageSize } = req.body;
      page = page ? page : ''
      pageSize = pageSize ? pageSize : ''
      //   const response = await axios.put(`${url}/api/venda/valida-venda-contingencia.xsjs?page=${page}&pageSize=${pageSize}`, {
      const response = await axios.put(`http://164.152.245.77:8000/quality/concentrador/api/venda/valida-venda-contingencia.xsjs`, {
        IDVENDA
      })
      
      return res.json(response.data);
    } catch (error) {
      console.error("Erro no ConsultaNfeController.putValidarVendaContigencia", error);
      return res.status(500).json({ error: error.message });
    }
  }
}

export default new ConsultaNfeController();