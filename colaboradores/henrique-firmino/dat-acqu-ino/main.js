const express = require('express');
const mysql = require('mysql2');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// constantes para configurações
const SERVIDOR_PORTA = 3300;
const SERIAL_BAUD_RATE = 9600;
const ID_SENSOR = 1;

// habilita ou desabilita a inserção no banco
const HABILITAR_OPERACAO_INSERIR = true;

// conexão com o banco de dados MySQL
const poolBancoDados = mysql.createPool({
    host: '127.0.0.1',
    user: 'user',
    password: 'insert1@fluxLog',
    database: 'fluxlog',
    port: 3307
}).promise();

let sensor1 = 0;
let eventoAtualId = null;
let ultimaLeitura = null;
let processando = false;

const sensores = [
    { id: ID_SENSOR, digital: 0 }
];

// função para simular a leitura dos sensores
async function simularSensores() {
    const portas = await SerialPort.list();

    const portaArduino = portas.find(porta =>
        porta.vendorId === '1a86' &&
        porta.productId === '7523'
    );

    if (!portaArduino) {
        throw new Error('Arduino não encontrado em nenhuma porta serial');
    }

    if (!globalThis.arduino) {
        globalThis.arduino = new SerialPort({
            path: portaArduino.path,
            baudRate: SERIAL_BAUD_RATE
        });

        const parser = globalThis.arduino.pipe(
            new ReadlineParser({ delimiter: '\n' })
        );

        parser.on('data', async (data) => {
            const leitura = Number(data.trim());

            if (
                (leitura !== 0 && leitura !== 1) ||
                leitura === ultimaLeitura ||
                processando
            ) {
                return;
            }

            processando = true;

            try {
                sensor1 = leitura;
                sensores[0].digital = leitura;

                if (HABILITAR_OPERACAO_INSERIR) {
                    if (leitura === 1 && eventoAtualId === null) {
                        const [resultado] = await poolBancoDados.execute(
                            'INSERT INTO evento (data_hora_inicio, fk_sensor) VALUES (NOW(), ?)',
                            [ID_SENSOR]
                        );

                        eventoAtualId = resultado.insertId;

                        console.log('Início do evento registrado:', eventoAtualId);
                    } else if (leitura === 0 && eventoAtualId !== null) {
                        await poolBancoDados.execute(
                            'UPDATE evento SET data_hora_fim = NOW() WHERE id = ?',
                            [eventoAtualId]
                        );

                        console.log('Fim do evento registrado:', eventoAtualId);

                        eventoAtualId = null;
                    }
                }

                ultimaLeitura = leitura;

            } catch (erro) {
                console.error('Erro ao registrar evento:', erro.message);
            } finally {
                processando = false;
            }
        });

        globalThis.arduino.on('open', () => {
            console.log('Arduino conectado em:', portaArduino.path);
        });

        globalThis.arduino.on('error', (erro) => {
            console.error('Erro na comunicação serial:', erro.message);
        });
    }
}

// função para inserir as leituras no banco
async function inserirDados() {
    if (HABILITAR_OPERACAO_INSERIR) {
        // O INSERT e o UPDATE dos eventos são realizados
        // quando o Arduino detecta uma mudança de estado.
        console.log('Estado atual do sensor:', sensores);
    }
}

// atualiza os sensores a cada segundo
setInterval(async () => {
    try {
        await simularSensores();

        console.log('Leituras atuais:', sensores);

        await inserirDados();
    } catch (erro) {
        console.error('Erro ao ler o sensor:', erro.message);
    }
}, 1000);

// função para criar o servidor web
const app = express();

app.use((request, response, next) => {
    response.header('Access-Control-Allow-Origin', '*');
    response.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
    next();
});

// endpoint para consultar todos os sensores
app.get('/sensores/digital', (request, response) => {
    return response.json(sensores);
});

// endpoint para consultar um sensor específico
app.get('/sensores/digital/:id', (request, response) => {
    const id = Number(request.params.id);

    const sensor = sensores.find((item) => item.id === id);

    if (sensor) {
        return response.json(sensor);
    } else {
        return response.status(404).json({
            mensagem: 'Sensor não encontrado'
        });
    }
});

// inicia o servidor
app.listen(SERVIDOR_PORTA, () => {
    console.log(`API executada com sucesso na porta ${SERVIDOR_PORTA}`);
});