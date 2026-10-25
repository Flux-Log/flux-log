const express = require('express');
const mysql = require('mysql2');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const SERVIDOR_PORTA = 3300;
const SERIAL_BAUD_RATE = 9600;
const HABILITAR_OPERACAO_INSERIR = true;

const poolBancoDados = mysql.createPool({
    host: '127.0.0.1',
    user: 'user',
    password: 'insert1@fluxLog',
    database: 'fluxlog',
    port: 3307
}).promise();

// Controlo dos sensores e flag de primeira execução
const sensores = Array.from({ length: 9 }, (_, index) => ({
    id: index + 1,
    digital: 0,
    ultimaLeitura: null,
    dataHoraInicioFixada: null,
    tempoPermanencia: 0,
    jaExecutouPrimeiraVez: false
}));

// Função auxiliar para calcular data/hora retroativa (apenas para a 1ª execução)
function calcularInicioRetroativo(minutosRetroativos = 0, segundosRetroativos = 0) {
    const totalSegundos = (minutosRetroativos * 60) + segundosRetroativos;
    const agora = new Date();
    agora.setSeconds(agora.getSeconds() - totalSegundos);
    
    const pad = (n) => String(n).padStart(2, '0');
    return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())} ${pad(agora.getHours())}:${pad(agora.getMinutes())}:${pad(agora.getSeconds())}`;
}

// 1º INSERT: Grava o início do evento usando NOW() do MySQL para tempo real
async function registrarInicioEvento(idSensor, dataHoraInicioStr = null) {
    try {
        if (dataHoraInicioStr) {
            // Se passou data retroativa (1ª execução), grava o valor fornecido
            await poolBancoDados.execute(
                `INSERT INTO evento (data_hora_inicio, status_evento, fk_sensor, classificacao)
                 VALUES (?, 'EM_ANDAMENTO', ?, 'EM_ANDAMENTO')`,
                [dataHoraInicioStr, idSensor]
            );
            console.log(`[SENSOR ${idSensor}] Início retroativo gravado no banco: ${dataHoraInicioStr}`);
        } else {
            // Em tempo real, usa o NOW() direto do MySQL para zerar dessincronia
            await poolBancoDados.execute(
                `INSERT INTO evento (data_hora_inicio, status_evento, fk_sensor, classificacao)
                 VALUES (NOW(), 'EM_ANDAMENTO', ?, 'EM_ANDAMENTO')`,
                [idSensor]
            );
            console.log(`[SENSOR ${idSensor}] Início em tempo real gravado com NOW() do MySQL!`);
        }
    } catch (erro) {
        console.error(`Erro ao gravar início do Sensor ${idSensor}:`, erro.message);
    }
}

// 2º INSERT: Grava a finalização calculando a diferença via MySQL
async function registrarFimEvento(idSensor, dataHoraInicioStr = null) {
    try {
        let duracaoSegundos = 0;

        if (dataHoraInicioStr) {
            // Para evento retroativo: calcula diferença entre a string inicial e o NOW() do banco
            const [calc] = await poolBancoDados.execute(
                `SELECT TIMESTAMPDIFF(SECOND, ?, NOW()) AS duracao`,
                [dataHoraInicioStr]
            );
            duracaoSegundos = calc[0]?.duracao || 0;
        } else {
            // Para evento em tempo real: pega o último evento EM_ANDAMENTO do sensor para calcular a duração exata
            const [calc] = await poolBancoDados.execute(
                `SELECT TIMESTAMPDIFF(SECOND, data_hora_inicio, NOW()) AS duracao, data_hora_inicio
                 FROM evento 
                 WHERE fk_sensor = ? AND status_evento = 'EM_ANDAMENTO' 
                 ORDER BY id DESC LIMIT 1`,
                [idSensor]
            );
            duracaoSegundos = calc[0]?.duracao || 0;
            if (calc[0]?.data_hora_inicio) {
                dataHoraInicioStr = calc[0].data_hora_inicio;
            }
        }

        // Garante que o valor nunca seja menor que zero por questão de milissegundos
        if (duracaoSegundos < 0) {
            duracaoSegundos = 0;
        }

        let classificacao = 'NORMAL';
        let tempoExcedido = 0;

        if (duracaoSegundos > 900) {
            classificacao = 'MUITO CRITICO';
            tempoExcedido = duracaoSegundos - 120;
        } else if (duracaoSegundos > 300) {
            classificacao = 'CONGESTIONAMENTO';
            tempoExcedido = duracaoSegundos - 120;
        } else if (duracaoSegundos > 120) {
            classificacao = 'ATENCAO';
            tempoExcedido = duracaoSegundos - 120;
        }

        // Se dataHoraInicioStr foi recuperado do banco ou veio da memória, grava com NOW() no término
        if (dataHoraInicioStr) {
            await poolBancoDados.execute(
                `INSERT INTO evento 
                (data_hora_inicio, data_hora_fim, duracao_segundos, classificacao, tempo_excedido_segundos, status_evento, fk_sensor)
                 VALUES (?, NOW(), ?, ?, ?, 'FINALIZADO', ?)`,
                [dataHoraInicioStr, duracaoSegundos, classificacao, tempoExcedido, idSensor]
            );
        } else {
            await poolBancoDados.execute(
                `INSERT INTO evento 
                (data_hora_inicio, data_hora_fim, duracao_segundos, classificacao, tempo_excedido_segundos, status_evento, fk_sensor)
                 VALUES (NOW(), NOW(), ?, ?, ?, 'FINALIZADO', ?)`,
                [duracaoSegundos, classificacao, tempoExcedido, idSensor]
            );
        }

        console.log(`[SENSOR ${idSensor}] Fim gravado! Duração: ${duracaoSegundos}s | Status: ${classificacao}`);
    } catch (erro) {
        console.error(`Erro ao finalizar evento do Sensor ${idSensor}:`, erro.message);
    }
}

// Conexão Arduino (Sensor 1 Físico)
async function conectarArduino() {
    try {
        const portas = await SerialPort.list();
        const portaArduino = portas.find(porta => 
            porta.path === 'COM11' || porta.vendorId === '1a86'
        );

        if (!portaArduino) return;

        if (!globalThis.arduino) {
            globalThis.arduino = new SerialPort({
                path: portaArduino.path,
                baudRate: SERIAL_BAUD_RATE
            });

            const parser = globalThis.arduino.pipe(
                new ReadlineParser({ delimiter: '\r\n' })
            );

            globalThis.arduino.on('open', () => {
                console.log('Arduino conectado na porta:', portaArduino.path);
            });

            parser.on('data', async (data) => {
                const leitura = Number(data.trim());
                if (leitura !== 0 && leitura !== 1) return;

                const sensor1 = sensores[0];
                if (leitura === sensor1.ultimaLeitura) return;

                sensor1.digital = leitura;
                sensor1.ultimaLeitura = leitura;

                console.log(`[SENSOR 1 MUDOU ESTADO PARA]: ${leitura}`);

                if (HABILITAR_OPERACAO_INSERIR) {
                    if (leitura === 1 && sensor1.dataHoraInicioFixada === null) {
                        if (!sensor1.jaExecutouPrimeiraVez) {
                            sensor1.dataHoraInicioFixada = calcularInicioRetroativo(3, 0);
                            sensor1.jaExecutouPrimeiraVez = true;
                            await registrarInicioEvento(1, sensor1.dataHoraInicioFixada);
                        } else {
                            sensor1.dataHoraInicioFixada = "TEMPO_REAL";
                            await registrarInicioEvento(1, null);
                        }
                    } else if (leitura === 0 && sensor1.dataHoraInicioFixada !== null) {
                        const inicioParam = sensor1.dataHoraInicioFixada === "TEMPO_REAL" ? null : sensor1.dataHoraInicioFixada;
                        await registrarFimEvento(1, inicioParam);
                        sensor1.dataHoraInicioFixada = null;
                    }
                }
            });

            globalThis.arduino.on('error', (erro) => {
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

        const deveMudar = Math.random() < 0.3;

        if (deveMudar) {
            const novoEstado = sensor.digital === 0 ? 1 : 0;
            
            if (novoEstado === 1) {
                sensor.tempoPermanencia = Math.floor(Math.random() * 9) + 4;
            } else {
                sensor.tempoPermanencia = Math.floor(Math.random() * 13) + 8;
            }

            sensor.digital = novoEstado;

            try {
                if (novoEstado === 1 && sensor.dataHoraInicioFixada === null) {
                    if (!sensor.jaExecutouPrimeiraVez) {
                        let min = 0;
                        let seg = 0;

                        if (sensor.id === 2) { min = 15; seg = 0; }
                        else if (sensor.id === 3) { min = 7; seg = 0; }
                        else if (sensor.id === 4) { min = 14; seg = 55; }
                        else if (sensor.id === 5) { min = 1; seg = 30; }
                        else if (sensor.id === 6) { min = 5; seg = 0; }
                        else { min = Math.floor(Math.random() * 4); }

                        sensor.dataHoraInicioFixada = calcularInicioRetroativo(min, seg);
                        sensor.jaExecutouPrimeiraVez = true;
                        await registrarInicioEvento(sensor.id, sensor.dataHoraInicioFixada);
                    } else {
                        sensor.dataHoraInicioFixada = "TEMPO_REAL";
                        await registrarInicioEvento(sensor.id, null);
                    }
                } else if (novoEstado === 0 && sensor.dataHoraInicioFixada !== null) {
                    const inicioParam = sensor.dataHoraInicioFixada === "TEMPO_REAL" ? null : sensor.dataHoraInicioFixada;
                    await registrarFimEvento(sensor.id, inicioParam);
                    sensor.dataHoraInicioFixada = null;
                }
            } catch (erro) {
                console.error(`Erro na simulação do Sensor ${sensor.id}:`, erro.message);
            }
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
    return response.json(sensores.map(s => ({ id: s.id, digital: s.digital })));
});

app.get('/sensores/digital/:id', (request, response) => {
    const id = Number(request.params.id);
    const sensor = sensores.find((item) => item.id === id);

    if (sensor) {
        return response.json({ id: sensor.id, digital: sensor.digital });
    } else {
        return response.status(404).json({ mensagem: 'Sensor não encontrado' });
    }
});

app.listen(SERVIDOR_PORTA, () => {
    console.log(`API executada com sucesso na porta ${SERVIDOR_PORTA}`);
});

// Captura Ctrl + C no terminal e encerra os eventos pendentes no banco
process.once('SIGINT', async () => {
    console.log('\n[API] Ctrl+C detectado! Finalizando eventos em andamento no banco...');

    try {
        for (const sensor of sensores) {
            if (sensor.digital === 1 && sensor.dataHoraInicioFixada !== null) {
                const inicioParam = sensor.dataHoraInicioFixada === "TEMPO_REAL" ? null : sensor.dataHoraInicioFixada;
                await registrarFimEvento(sensor.id, inicioParam);
                console.log(`[SENSOR ${sensor.id}] Evento pendente encerrado com sucesso.`);
            }
        }
    } catch (erro) {
        console.error('Erro ao finalizar eventos no encerramento:', erro.message);
    } finally {
        console.log('[API] Aplicação encerrada com sucesso!');
        process.exit(0);
    }
});