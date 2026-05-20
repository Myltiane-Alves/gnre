import Joi from "joi";

export const inativarFuncionarioSchema = Joi.object({
  DATAULTIMAALTERACAO: Joi.date().required().messages({
    "date.base": "DATAULTIMAALTERACAO deve ser uma data válida",
    "any.required": "DATAULTIMAALTERACAO é obrigatória"
  }),
  STATIVO: Joi.string().valid("False").required().messages({
    "any.only": "STATIVO deve ser 'False'"
  }),
  DATA_DEMISSAO: Joi.date().required().messages({
    "date.base": "DATA_DEMISSAO deve ser uma data válida",
    "any.required": "DATA_DEMISSAO é obrigatória"
  }),
  ID: Joi.number().integer().required().messages({
    "number.base": "ID deve ser um número inteiro",
    "any.required": "ID é obrigatório"
  })
});
