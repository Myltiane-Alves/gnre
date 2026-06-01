import 'dotenv/config';
import express from 'express';
import router from '../routes.mjs';

const app = express();
const PORT = process.env.PORT || 6001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/ping', (_req, res) => {
  res.json({ status: 'ok', porta: PORT, timestamp: new Date().toISOString() });
});

app.use(router);

app.listen(PORT, () => {
  console.log(`gnre-node rodando na porta ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/ping`);
});
