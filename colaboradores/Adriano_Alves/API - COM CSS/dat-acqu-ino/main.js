const express = require('express');
const mysql = require('mysql2');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const SERVIDOR_PORTA = 3300;
const SERIAL_BAUD_RATE = 9600;
const HABILITAR_OPERACAO_INSERIR = true;

// Conexão com o banco de dados MySQL
const poolBancoDados = mysql.createPool({
    host: '127.0.0.1',
    user: 'user',
    password: 'insert1@fluxLog',
    database: 'fluxlog',
    port: 3307
}).promise();

// Instância global para a porta do Arduino
let conexaoArduino = null;


const sensores = [];
for (let i = 0; i < 9; i++) {
    sensores[i] = {
        id: i + 1,
        digital: 0,
        ultimaLeitura: null,
        dataHoraInicioFixada: null,
        tempoPermanencia: 0,
        jaExecutouPrimeiraVez: false,
        passoSequencia: 1 // Usado para controlar a sequência de tempos específicos
    };
}

// 1º INSERT: Grava o início do evento usando apenas o MySQL (NOW e subtração por INTERVAL)
async function registrarInicioEvento(idSensor, segundosRetroativos = 0) {
    try {
        if (segundosRetroativos > 0) {
            await poolBancoDados.execute(
                `INSERT INTO evento (data_hora_inicio, status_evento, fk_sensor, classificacao)
                 VALUES (NOW() - INTERVAL ? SECOND, 'EM_ANDAMENTO', ?, 'EM_ANDAMENTO')`,
                [segundosRetroativos, idSensor]
            );
            console.log(`[SENSOR ${idSensor}] Início retroativo (${segundosRetroativos}s atrás) gravado via MySQL!`);
        } else {
            await poolBancoDados.execute(
                `INSERT INTO evento (data_hora_inicio, status_evento, fk_sensor, classificacao)
                 VALUES (NOW(), 'EM_ANDAMENTO', ?, 'EM_ANDAMENTO')`,
                [idSensor]
            );
            console.log(`[SENSOR ${idSensor}] Início em tempo real gravado com NOW()!`);
        }
    } catch (erro) {
        console.error(`Erro ao gravar início do Sensor ${idSensor}:`, erro.message);
    }
}

// 2º INSERT: Grava a finalização calculando a duração via MySQL
async function registrarFimEvento(idSensor) {
    try {
        let duracaoSegundos = 0;
        let dataHoraInicioStr = null;

        const [calc] = await poolBancoDados.execute(
            `SELECT TIMESTAMPDIFF(SECOND, data_hora_inicio, NOW()) AS duracao, data_hora_inicio
             FROM evento 
             WHERE fk_sensor = ? AND status_evento = 'EM_ANDAMENTO' 
             ORDER BY id DESC LIMIT 1`,
            [idSensor]
        );

        if (calc.length > 0) {
            duracaoSegundos = calc[0].duracao || 0;
            if (calc[0].data_hora_inicio) {
                dataHoraInicioStr = calc[0].data_hora_inicio;
            }
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
            classificacao = 'ATENCÃO';
            tempoExcedido = duracaoSegundos - 120;
        }

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
        let portaArduino = null;

        for (let i = 0; i < portas.length; i++) {
            if (portas[i].path === 'COM11' || portas[i].vendorId === '1a86') {
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
                if (leitura === sensor1.ultimaLeitura) return;

                sensor1.digital = leitura;
                sensor1.ultimaLeitura = leitura;

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

        // SENSOR 2: 4s no 0 -> 2s no 1 -> 2s no 0 -> 10s no 1
        if (sensor.id === 2) {
            if (sensor.passoSequencia === 1) {
                novoEstado = 0; sensor.tempoPermanencia = 3; sensor.passoSequencia = 2;
            } else if (sensor.passoSequencia === 2) {
                novoEstado = 1; sensor.tempoPermanencia = 1; sensor.passoSequencia = 3;
            } else if (sensor.passoSequencia === 3) {
                novoEstado = 0; sensor.tempoPermanencia = 1; sensor.passoSequencia = 4;
            } else if (sensor.passoSequencia === 4) {
                novoEstado = 1; sensor.tempoPermanencia = 7; sensor.passoSequencia = 1;
            }
        }
        // SENSOR 3: 3s no 1 -> 1s no 0 -> 4 min (240s) no 1 -> 2s no 0
        else if (sensor.id === 3) {
            if (sensor.passoSequencia === 1) {
                novoEstado = 1; sensor.tempoPermanencia = 2; sensor.passoSequencia = 2;
            } else if (sensor.passoSequencia === 2) {
                novoEstado = 0; sensor.tempoPermanencia = 1; sensor.passoSequencia = 3;
            } else if (sensor.passoSequencia === 3) {
                novoEstado = 1; sensor.tempoPermanencia = 160; sensor.passoSequencia = 4;
            } else if (sensor.passoSequencia === 4) {
                novoEstado = 0; sensor.tempoPermanencia = 1; sensor.passoSequencia = 1;
            }
        }
        // SENSOR 4: 10s no 0 -> 700s no 1 -> 20s no 0 -> 600s no 1
        else if (sensor.id === 4) {
            if (sensor.passoSequencia === 1) {
                novoEstado = 0; sensor.tempoPermanencia = 7; sensor.passoSequencia = 2;
            } else if (sensor.passoSequencia === 2) {
                novoEstado = 1; sensor.tempoPermanencia = 467; sensor.passoSequencia = 3;
            } else if (sensor.passoSequencia === 3) {
                novoEstado = 0; sensor.tempoPermanencia = 13; sensor.passoSequencia = 4;
            } else if (sensor.passoSequencia === 4) {
                novoEstado = 1; sensor.tempoPermanencia = 400; sensor.passoSequencia = 1;
            }
        }
        // SENSOR 5: 5s no 0 -> 2s no 1 -> 2s no 0 -> 3s no 1
        else if (sensor.id === 5) {
            if (sensor.passoSequencia === 1) {
                novoEstado = 0; sensor.tempoPermanencia = 3; sensor.passoSequencia = 2;
            } else if (sensor.passoSequencia === 2) {
                novoEstado = 1; sensor.tempoPermanencia = 1; sensor.passoSequencia = 3;
            } else if (sensor.passoSequencia === 3) {
                novoEstado = 0; sensor.tempoPermanencia = 1; sensor.passoSequencia = 4;
            } else if (sensor.passoSequencia === 4) {
                novoEstado = 1; sensor.tempoPermanencia = 2; sensor.passoSequencia = 1;
            }
        }
        // SENSOR 6: 7s no 0 -> 20s no 1 -> 10s no 0 -> 300s no 1
        else if (sensor.id === 6) {
            if (sensor.passoSequencia === 1) {
                novoEstado = 0; sensor.tempoPermanencia = 5; sensor.passoSequencia = 2;
            } else if (sensor.passoSequencia === 2) {
                novoEstado = 1; sensor.tempoPermanencia = 13; sensor.passoSequencia = 3;
            } else if (sensor.passoSequencia === 3) {
                novoEstado = 0; sensor.tempoPermanencia = 7; sensor.passoSequencia = 4;
            } else if (sensor.passoSequencia === 4) {
                novoEstado = 1; sensor.tempoPermanencia = 200; sensor.passoSequencia = 1;
            }
        }
        // SENSOR 7: 8s no 0 -> 100s no 1 -> 40s no 0 -> 250s no 1
        else if (sensor.id === 7) {
            if (sensor.passoSequencia === 1) {
                novoEstado = 0; sensor.tempoPermanencia = 5; sensor.passoSequencia = 2;
            } else if (sensor.passoSequencia === 2) {
                novoEstado = 1; sensor.tempoPermanencia = 67; sensor.passoSequencia = 3;
            } else if (sensor.passoSequencia === 3) {
                novoEstado = 0; sensor.tempoPermanencia = 27; sensor.passoSequencia = 4;
            } else if (sensor.passoSequencia === 4) {
                novoEstado = 1; sensor.tempoPermanencia = 167; sensor.passoSequencia = 1;
            }
        }
        // SENSOR 8: 10s no 0 -> 60s no 1 -> 30s no 0 -> 300s no 1
        else if (sensor.id === 8) {
            if (sensor.passoSequencia === 1) {
                novoEstado = 0; sensor.tempoPermanencia = 7; sensor.passoSequencia = 2;
            } else if (sensor.passoSequencia === 2) {
                novoEstado = 1; sensor.tempoPermanencia = 40; sensor.passoSequencia = 3;
            } else if (sensor.passoSequencia === 3) {
                novoEstado = 0; sensor.tempoPermanencia = 20; sensor.passoSequencia = 4;
            } else if (sensor.passoSequencia === 4) {
                novoEstado = 1; sensor.tempoPermanencia = 200; sensor.passoSequencia = 1;
            }
        }
        // SENSOR 9: 5s no 0 -> 60s no 1 -> 10s no 0 -> 450s no 1
        else if (sensor.id === 9) {
            if (sensor.passoSequencia === 1) {
                novoEstado = 0; sensor.tempoPermanencia = 3; sensor.passoSequencia = 2;
            } else if (sensor.passoSequencia === 2) {
                novoEstado = 1; sensor.tempoPermanencia = 40; sensor.passoSequencia = 3;
            } else if (sensor.passoSequencia === 3) {
                novoEstado = 0; sensor.tempoPermanencia = 7; sensor.passoSequencia = 4;
            } else if (sensor.passoSequencia === 4) {
                novoEstado = 1; sensor.tempoPermanencia = 300; sensor.passoSequencia = 1;
            }
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

// Servidor Express
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
// sigint usa para finalizar os em andamento apos encerrar a bash.
process.once('SIGINT', async () => {
    console.log('\n[API] Ctrl+C detectado! Finalizando eventos em andamento no banco...');

    try {
        for (let i = 0; i < sensores.length; i++) {
            const sensor = sensores[i];
            if (sensor.digital === 1 && sensor.dataHoraInicioFixada !== null) {
                await registrarFimEvento(sensor.id);
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