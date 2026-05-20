import Joi from 'joi';

export const linkRelatorioBiSchema = Joi.object({
    LINK: Joi.string().required().messages({
        'string.base': 'LINK deve ser uma string',
        'any.required': 'LINK é obrigatório'
    }),
    STATIVO: Joi.string().required().messages({
        'string.base': 'STATIVO deve ser uma string',
        'any.required': 'STATIVO é obrigatório'
    }),
    IDRELATORIOBI: Joi.number().required().messages({
        'number.base': 'IDRELATORIOBI deve ser um número',
        'any.required': 'IDRELATORIOBI é obrigatório'
    }),
    IDEMPRESA: Joi.number().required().messages({
        'number.base': 'IDRELATORIOBI deve ser um número',
        'any.required': 'IDRELATORIOBI é obrigatório'
    }),
})