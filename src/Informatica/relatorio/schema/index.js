import Joi from 'joi';

export const criarRelatoriosSchema= Joi.object({
    IDRELATORIOBI: Joi.number().integer().required().menssages({
        'data.base': 'IDRELATORIOBI deve ser um número inteiro',
        'any.required': 'IDRELATORIOBI é obrigatório'
    }),
    IDEMPRESA: Joi.number().integer().required().menssages({
        'data.base': 'IDEMPRESA deve ser um número inteiro',
        'any.required': 'IDEMPRESA é obrigatório'
    }),
    LINK: Joi.string().required().menssages({
        'data.base': 'LINK deve ser uma string',
        'any.required': 'LINK é obrigatório'
    }),
    STATIVO: Joi.string().required().menssages({
        'data.base': 'STATIVO deve ser uma string',
        'any.required': 'STATIVO é obrigatório'
    })

});
