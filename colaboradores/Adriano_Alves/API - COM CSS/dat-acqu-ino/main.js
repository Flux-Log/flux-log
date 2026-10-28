
const express = require('express');
const mysql = require('mysql2');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const SERVIDOR_PORTA = 3300;
const SERIAL_BAUD_RATE = 9600;
const HABILITAR_OPERACAO_INSERIR = true;


const poolBancoDados = mysql.createPool({
    host: '127.0.0.1',
    user: 'insert_fluxlog',
    password: 'Insert@1',
    database: 'fluxlog',
    port: 3307,
    dateStrings: true
}).promise();

let conexaoArduino = null;

// Formata timestamp em 'YYYY-MM-DD HH:MM:SS' na hora local
function formatarDataLocal(timestampMs = Date.now()) {
    const d = new Date(timestampMs);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    const horas = String(d.getHours()).padStart(2, '0');
    const minutos = String(d.getMinutes()).padStart(2, '0');
    const segundos = String(d.getSeconds()).padStart(2, '0');
    return `${ano}-${mes}-${dia} ${horas}:${minutos}:${segundos}`;
}

const sensores = [];
for (let i = 0; i < 9; i++) {
    sensores[i] = {
        id: i + 1,
        digital: 0,
        dataHoraInicioFixada: null,
        tempoPermanencia: 0,
        jaExecutouPrimeiraVez: false,
        passoSequencia: 1,
        dataHoraInicioTexto: null,
        timestampInicioMs: null
    };
}

// 1º INSERT: Grava o início do evento
async function registrarInicioEvento(idSensor, segundosRetroativos = 0) {
    try {
        const sensor = sensores[idSensor - 1];
        
        const agoraMs = Date.now();
        const retroativoMs = segundosRetroativos * 1000;
        
        sensor.timestampInicioMs = agoraMs - retroativoMs;
        sensor.dataHoraInicioTexto = formatarDataLocal(sensor.timestampInicioMs);

        await poolBancoDados.execute(
            `INSERT INTO evento (data_hora_inicio, status_evento, fk_sensor, classificacao)
             VALUES (?, 'EM_ANDAMENTO', ?, 'EM_ANDAMENTO')`,
            [sensor.dataHoraInicioTexto, idSensor]
        );

        if (segundosRetroativos > 0) {
            console.log(`[SENSOR ${idSensor}] Início retroativo (${segundosRetroativos}s atrás) gravado!`);
        } else {
            console.log(`[SENSOR ${idSensor}] Início em tempo real gravado!`);
        }
    } catch (erro) {
        console.error(`Erro ao gravar início do Sensor ${idSensor}:`, erro.message);
    }
}

// 2º INSERT: Finaliza o evento reutilizando a string do início salva
async function registrarFimEvento(idSensor) {
    try {
        const sensor = sensores[idSensor - 1];
        let duracaoSegundos = 0;
        const agoraMs = Date.now();
        const dataHoraFimStr = formatarDataLocal(agoraMs);
        const dataHoraInicioStr = sensor.dataHoraInicioTexto || dataHoraFimStr;

        if (sensor.timestampInicioMs) {
            duracaoSegundos = Math.floor((agoraMs - sensor.timestampInicioMs) / 1000);
            sensor.timestampInicioMs = null;
            sensor.dataHoraInicioTexto = null;
        }

        if (duracaoSegundos < 0) {
            duracaoSegundos = 0;
        }

        let classificacao = 'NORMAL';
        let tempoExcedido = 0;

        if (duracaoSegundos > 900) {
            classificacao = 'PROLONGADO';
            tempoExcedido = duracaoSegundos - 120;
        } else if (duracaoSegundos > 300) {
            classificacao = 'PROLONGADO';
            tempoExcedido = duracaoSegundos - 120;
        } else if (duracaoSegundos > 120) {
            classificacao = 'ATENÇÃO';
            tempoExcedido = duracaoSegundos - 120;
        }

        await poolBancoDados.execute(
            `INSERT INTO evento 
            (data_hora_inicio, data_hora_fim, duracao_segundos, classificacao, tempo_excedido_segundos, status_evento, fk_sensor)
             VALUES (?, ?, ?, ?, ?, 'FINALIZADO', ?)`,
            [dataHoraInicioStr, dataHoraFimStr, duracaoSegundos, classificacao, tempoExcedido, idSensor]
        );

        console.log(`[SENSOR ${idSensor}] Fim gravado! Duração: ${duracaoSegundos}s | Status: ${classificacao}`);
    } catch (erro) {
        console.error(`Erro ao finalizar evento do Sensor ${idSensor}:`, erro.message);
    }
}

// Conexão Arduino (Sensor 1 Físico)
async function conectarArduino() {
    try {
        const portas = await SerialPort.list();
        let portaArduino = null;

        for (let i = 0; i < portas.length; i++) {
            if (portas[i].path === 'COM10' || portas[i].vendorId === '1a86') {
                portaArduino = portas[i];
                break;
            }
        }

        if (!portaArduino) return;

        if (!conexaoArduino) {
            conexaoArduino = new SerialPort({
                path: portaArduino.path,
                baudRate: SERIAL_BAUD_RATE
            });

            const parser = conexaoArduino.pipe(
                new ReadlineParser({ delimiter: '\r\n' })
            );

            conexaoArduino.on('open', () => {
                console.log('Arduino conectado na porta:', portaArduino.path);
            });

            parser.on('data', async (data) => {
                const leitura = Number(data.trim());
                if (leitura !== 0 && leitura !== 1) return;

                const sensor1 = sensores[0];
                if (leitura === sensor1.digital) return;

                sensor1.digital = leitura;

                console.log(`[SENSOR 1 MUDOU ESTADO PARA]: ${leitura}`);

                if (HABILITAR_OPERACAO_INSERIR) {
                    if (leitura === 1 && sensor1.dataHoraInicioFixada === null) {
                        if (!sensor1.jaExecutouPrimeiraVez) {
                            sensor1.dataHoraInicioFixada = "RETROATIVO";
                            sensor1.jaExecutouPrimeiraVez = true;
                            await registrarInicioEvento(1, 180);
                        } else {
                            sensor1.dataHoraInicioFixada = "TEMPO_REAL";
                            await registrarInicioEvento(1, 0);
                        }
                    } else if (leitura === 0 && sensor1.dataHoraInicioFixada !== null) {
                        await registrarFimEvento(1);
                        sensor1.dataHoraInicioFixada = null;
                    }
                }
            });

            conexaoArduino.on('error', (erro) => {
                console.error('Erro na serial:', erro.message);
            });
        }
    } catch (erro) {
        console.error('Erro ao listar portas:', erro.message);
    }
}

conectarArduino();

// Simulação dos Sensores Virtuais (2 a 9)
async function inserirDados() {
    if (!HABILITAR_OPERACAO_INSERIR) return;

    for (let i = 1; i < sensores.length; i++) {
        const sensor = sensores[i];

        if (sensor.tempoPermanencia > 0) {
            sensor.tempoPermanencia--;
            continue;
        }

        let novoEstado = sensor.digital;

        // --- REGRAS DE TEMPOS PERSONALIZADAS PARA CADA SENSOR ---
        if (sensor.id === 2) {
            if (sensor.passoSequencia === 1) { novoEstado = 0; sensor.tempoPermanencia = 3; sensor.passoSequencia = 2; }
            else if (sensor.passoSequencia === 2) { novoEstado = 1; sensor.tempoPermanencia = 1; sensor.passoSequencia = 3; }
            else if (sensor.passoSequencia === 3) { novoEstado = 0; sensor.tempoPermanencia = 1; sensor.passoSequencia = 4; }
            else if (sensor.passoSequencia === 4) { novoEstado = 1; sensor.tempoPermanencia = 7; sensor.passoSequencia = 1; }
        }
        else if (sensor.id === 3) {
            if (sensor.passoSequencia === 1) { novoEstado = 1; sensor.tempoPermanencia = 2; sensor.passoSequencia = 2; }
            else if (sensor.passoSequencia === 2) { novoEstado = 0; sensor.tempoPermanencia = 1; sensor.passoSequencia = 3; }
            else if (sensor.passoSequencia === 3) { novoEstado = 1; sensor.tempoPermanencia = 7; sensor.passoSequencia = 4; }
            else if (sensor.passoSequencia === 4) { novoEstado = 0; sensor.tempoPermanencia = 1; sensor.passoSequencia = 1; }
        }
        else if (sensor.id === 4) {
            if (sensor.passoSequencia === 1) { novoEstado = 0; sensor.tempoPermanencia = 7; sensor.passoSequencia = 2; }
            else if (sensor.passoSequencia === 2) { novoEstado = 1; sensor.tempoPermanencia = 467; sensor.passoSequencia = 3; }
            else if (sensor.passoSequencia === 3) { novoEstado = 0; sensor.tempoPermanencia = 13; sensor.passoSequencia = 4; }
            else if (sensor.passoSequencia === 4) { novoEstado = 1; sensor.tempoPermanencia = 400; sensor.passoSequencia = 1; }
        }
        else if (sensor.id === 5) {
            if (sensor.passoSequencia === 1) { novoEstado = 0; sensor.tempoPermanencia = 3; sensor.passoSequencia = 2; }
            else if (sensor.passoSequencia === 2) { novoEstado = 1; sensor.tempoPermanencia = 1; sensor.passoSequencia = 3; }
            else if (sensor.passoSequencia === 3) { novoEstado = 0; sensor.tempoPermanencia = 1; sensor.passoSequencia = 4; }
            else if (sensor.passoSequencia === 4) { novoEstado = 1; sensor.tempoPermanencia = 2; sensor.passoSequencia = 1; }
        }
        else if (sensor.id === 6) {
            if (sensor.passoSequencia === 1) { novoEstado = 0; sensor.tempoPermanencia = 5; sensor.passoSequencia = 2; }
            else if (sensor.passoSequencia === 2) { novoEstado = 1; sensor.tempoPermanencia = 13; sensor.passoSequencia = 3; }
            else if (sensor.passoSequencia === 3) { novoEstado = 0; sensor.tempoPermanencia = 7; sensor.passoSequencia = 4; }
            else if (sensor.passoSequencia === 4) { novoEstado = 1; sensor.tempoPermanencia = 200; sensor.passoSequencia = 1; }
        }
        else if (sensor.id === 7) {
            if (sensor.passoSequencia === 1) { novoEstado = 0; sensor.tempoPermanencia = 5; sensor.passoSequencia = 2; }
            else if (sensor.passoSequencia === 2) { novoEstado = 1; sensor.tempoPermanencia = 67; sensor.passoSequencia = 3; }
            else if (sensor.passoSequencia === 3) { novoEstado = 0; sensor.tempoPermanencia = 27; sensor.passoSequencia = 4; }
            else if (sensor.passoSequencia === 4) { novoEstado = 1; sensor.tempoPermanencia = 167; sensor.passoSequencia = 1; }
        }
        else if (sensor.id === 8) {
            if (sensor.passoSequencia === 1) { novoEstado = 0; sensor.tempoPermanencia = 7; sensor.passoSequencia = 2; }
            else if (sensor.passoSequencia === 2) { novoEstado = 1; sensor.tempoPermanencia = 40; sensor.passoSequencia = 3; }
            else if (sensor.passoSequencia === 3) { novoEstado = 0; sensor.tempoPermanencia = 20; sensor.passoSequencia = 4; }
            else if (sensor.passoSequencia === 4) { novoEstado = 1; sensor.tempoPermanencia = 200; sensor.passoSequencia = 1; }
        }
        else if (sensor.id === 9) {
            if (sensor.passoSequencia === 1) { novoEstado = 0; sensor.tempoPermanencia = 3; sensor.passoSequencia = 2; }
            else if (sensor.passoSequencia === 2) { novoEstado = 1; sensor.tempoPermanencia = 40; sensor.passoSequencia = 3; }
            else if (sensor.passoSequencia === 3) { novoEstado = 0; sensor.tempoPermanencia = 7; sensor.passoSequencia = 4; }
            else if (sensor.passoSequencia === 4) { novoEstado = 1; sensor.tempoPermanencia = 300; sensor.passoSequencia = 1; }
        }

        sensor.digital = novoEstado;

        try {
            if (novoEstado === 1 && sensor.dataHoraInicioFixada === null) {
                if (!sensor.jaExecutouPrimeiraVez) {
                    let segundosRetroativos = 0;

                    if (sensor.id === 2) { segundosRetroativos = 15 * 60; }
                    else if (sensor.id === 3) { segundosRetroativos = 7 * 60; }
                    else if (sensor.id === 4) { segundosRetroativos = (14 * 60) + 55; }
                    else if (sensor.id === 5) { segundosRetroativos = (1 * 60) + 30; }
                    else if (sensor.id === 6) { segundosRetroativos = 5 * 60; }
                    else if (sensor.id === 7) { segundosRetroativos = 210; }
                    else if (sensor.id === 8) { segundosRetroativos = 240; }
                    else if (sensor.id === 9) { segundosRetroativos = 270; }

                    sensor.dataHoraInicioFixada = "RETROATIVO";
                    sensor.jaExecutouPrimeiraVez = true;
                    await registrarInicioEvento(sensor.id, segundosRetroativos);
                } else {
                    sensor.dataHoraInicioFixada = "TEMPO_REAL";
                    await registrarInicioEvento(sensor.id, 0);
                }
            } else if (novoEstado === 0 && sensor.dataHoraInicioFixada !== null) {
                await registrarFimEvento(sensor.id);
                sensor.dataHoraInicioFixada = null;
            }
        } catch (erro) {
            console.error(`Erro na simulação do Sensor ${sensor.id}:`, erro.message);
        }
    }
}

setInterval(async () => {
    try {
        await inserirDados();
    } catch (erro) {
        console.error('Erro ao processar dados:', erro.message);
    }
}, 1500);


const app = express();

app.use((request, response, next) => {
    response.header('Access-Control-Allow-Origin', '*');
    response.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
    next();
});

app.get('/sensores/digital', (request, response) => {
    const listaSensores = [];
    for (let i = 0; i < sensores.length; i++) {
        listaSensores[i] = {
            id: sensores[i].id,
            digital: sensores[i].digital
        };
    }
    return response.json(listaSensores);
});

app.get('/sensores/digital/:id', (request, response) => {
    const id = Number(request.params.id);
    let sensorEncontrado = null;

    for (let i = 0; i < sensores.length; i++) {
        if (sensores[i].id === id) {
            sensorEncontrado = sensores[i];
            break;
        }
    }

    if (sensorEncontrado) {
        return response.json({ id: sensorEncontrado.id, digital: sensorEncontrado.digital });
    } else {
        return response.status(404).json({ mensagem: 'Sensor não encontrado' });
    }
});

app.listen(SERVIDOR_PORTA, () => {
    console.log(`API executada com sucesso na porta ${SERVIDOR_PORTA}`);
});

process.once('SIGINT', async () => {
    console.log('\n[API] Ctrl+C detectado! Encerrando aplicação...');
    console.log('[API] Aplicação encerrada com sucesso!');
    process.exit(0);
});