import Joi from 'joi';

export const linkRelatorioBiSchema = Joi.object({
    IDRELATORIOBI: Joi.number().required().messages({
        'number.base': 'IDRELATORIOBI deve ser um número',
        'any.required': 'IDRELATORIOBI é obrigatório'
    }),
    IDEMPRESA: Joi.number().required().messages({
        'number.base': 'IDEMPRESA deve ser um número',
        'any.required': 'IDEMPRESA é obrigatório'
    }),
    LINK: Joi.string().required().messages({
        'string.base': 'STATIVO deve ser uma string',
        'any.required': 'STATIVO é obrigatório'
    }),
    STATIVO: Joi.string().required().messages({
        'string.base': 'STATIVO deve ser uma string',
        'any.required': 'STATIVO é obrigatório'
    }),
    IDRELATORIOBIANTIGO: Joi.number().required().messages({
        'number.base': 'IDEMPRESA deve ser um número',
        'any.required': 'IDEMPRESA é obrigatório'
    }),
})
