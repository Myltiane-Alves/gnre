import Joi from 'joi';

export const putRelatorioBiSchema = Joi.object({
    DSRELATORIOBI: Joi.string().required().messages({
        'string.base': 'DSRELATORIOBI deve ser uma string',
        'any.required': 'DSRELATORIOBI é obrigatório'
    }),
    STATIVO: Joi.string().required().messages({
        'string.base': 'STATIVO deve ser uma string',
        'any.required': 'STATIVO é obrigatório'
    }),
    IDRELATORIOBI: Joi.number().required().messages({
        'number.base': 'IDRELATORIOBI deve ser um número',
        'any.required': 'IDRELATORIOBI é obrigatório'
    }),
})