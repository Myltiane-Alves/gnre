import Joi from 'joi';

export const relatorioBiSchema = Joi.object({
    DSRELATORIOBI: Joi.string().required().messages({
        'string.base': 'DSRELATORIOBI deve ser uma string',
        'any.required': 'DSRELATORIOBI é obrigatório'
    }),
    STATIVO:  Joi.string().required().messages({
        'string.base': 'STATIVO deve ser uma string',
        'any.required': 'STATIVO é obrigatório'
    }),
})