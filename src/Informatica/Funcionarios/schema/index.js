import Joi from 'joi';

const funcionarioSchema = Joi.object({
    IDFUNCIONARIO: Joi.number().integer().required()
        .messages({
            'number.base': 'IDFUNCIONARIO deve ser um número inteiro',
            'any.required': 'ID do funcionario é obrigatório'
        }),

    IDSUBGRUPOEMPRESARIAL: Joi.number().integer().required()
        .messages({
            'number.base': 'IDSUBGRUPOEMPRESARIAL deve ser um número inteiro',
            'any.required': 'ID do Subgrupo empresarial é obrigatório'
        }),

    NOFUNCIONARIO: Joi.string().allow('')
        .messages({
            'string.base': 'NOFUNCIONARIO deve ser uma string',
            'string.max': 'NOFUNCIONARIO deve ter no máximo 500 caracteres'
        }),

    NUCPF: Joi.string().allow('')
        .messages({
            'string.base': 'NUCPF deve ser uma string',
            'string.max': 'NUCPF deve ter no máximo 11 caracteres'
        }),

    PWSENHA: Joi.string().allow('')
        .messages({
            'string.base': 'PWSENHA deve ser uma string',
            'string.max': 'PWSENHA deve ter no máximo 500 caracteres'
        }),

    DSTIPO: Joi.string().allow('')
        .messages({
            'string.base': 'DSTIPO deve ser uma string',
            'string.max': 'DSTIPO deve ter no máximo 500 caracteres'
        }),

    DTADMISSAO: Joi.string().allow('')
        .messages({
            'string.base': 'DTADMISSAO deve ser uma string',
            'string.max': 'DTADMISSAO deve ter no máximo 500 caracteres'
        }),

    IDPERFIL: Joi.number().integer().required()
        .messages({
            'number.base': 'IDPERFIL deve ser um número inteiro',
            'any.required': 'ID perfil é obrigatório'
        }),

    DSFUNCAO: Joi.string().allow('')
        .messages({
            'string.base': 'DSFUNCAO deve ser uma string',
            'string.max': 'DSFUNCAO deve ter no máximo 500 caracteres'
        }),

    STCONVENIO: Joi.string().allow('')
        .messages({
            'string.base': 'STCONVENIO deve ser uma string',
            'string.max': 'STCONVENIO deve ter no máximo 500 caracteres'
        }),

    STDESCONTOFOLHA: Joi.string().allow('')
        .messages({
            'string.base': 'STDESCONTOFOLHA deve ser uma string',
            'string.max': 'STDESCONTOFOLHA deve ter no máximo 500 caracteres'
        }),

    STLOJA: Joi.string().allow('')
        .messages({
            'string.base': 'STLOJA deve ser uma string',
            'string.max': 'STLOJA deve ter no máximo 500 caracteres'
        }),

    STATIVO: Joi.string().allow('')
        .messages({
            'string.base': 'STATIVO deve ser uma string',
            'string.max': 'STATIVO deve ter no máximo 500 caracteres'
        }),

    IDFUNCALTERACAO: Joi.number().integer().required()
        .messages({
            'number.base': 'IDFUNCALTERACAO deve ser um número inteiro',
            'any.required': 'ID funcionario alteração é obrigatório'
        }),

    MOTIVODESC: Joi.string().allow('')
        .messages({
            'string.base': 'MOTIVODESC deve ser uma string',
            'string.max': 'motivo desconto deve ter no máximo 500 caracteres'
        }),

    ID: Joi.number().integer().required()
        .messages({
            'number.base': 'ID deve ser um número inteiro',
            'any.required': 'ID do funcionario é obrigatório'
        }),

})
export default funcionarioSchema;

