var database = require("../database/config");

function cadastrar(logradouro, cep, fk_empresa) {

    var instrucaoSql = `INSERT INTO endereco (logradouro, cep, fk_empresa) VALUES ('${logradouro}', '${cep}', '${fk_empresa}')`;

    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}


module.exports = {
    cadastrar
}
