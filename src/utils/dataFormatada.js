import { format, parse, parseJSON, parseISO } from 'date-fns';

export const dataFormatada = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const formatosDeData = [
        "yyyy-MM-dd HH:mm:ss", // Formato esperado na URL
        "yyyy-MM-dd HH:mm", // Adicione outros formatos conforme necessário
        // Adicione mais formatos de data se forem esperados outros formatos na URL
    ];

    for (const formato of formatosDeData) {
        try {
            const parseData = parse(value, formato, new Date());
            if (parseData instanceof Date && !isNaN(parseData)) {
                return format(parseData, 'yyyy-MM-dd HH:mm:ss');
            }
        } catch (error) {
            // Ignorar erros de análise e tentar próximo formato, se houver
        }
    }

    return value; // Retorna o próprio valor se não foi possível fazer o parse
};


