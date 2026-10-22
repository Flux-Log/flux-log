
const serialport = require('serialport');
const express = require('express');
const mysql = require('mysql2');

const SERIAL_BAUD_RATE = 9600;
const SERVIDOR_PORTA = 3300;

const HABILITAR_OPERACAO_INSERIR = false;

const serial = async (valoresSensores) => {

    let poolBancoDados = mysql.createPool({
        host: 'localhost',
        user: 'user_insert',
        password: 'fluxlog123',
        database: 'fluxlog',
        port: 3306
    }).promise();

    const sensoresSimulados = [
        { id: 18, intervalo: 20000, duracao: 8000 },
        { id: 19, intervalo: 45000, duracao: 15000 },
        { id: 20, intervalo: 15000, duracao: 5000 },
        { id: 21, intervalo: 60000, duracao: 20000 },
        { id: 22, intervalo: 30000, duracao: 10000 },
        { id: 23, intervalo: 90000, duracao: 25000 },
        { id: 24, intervalo: 25000, duracao: 7000 }
    ];

    async function registrarEvento(idSensor, statusEvento) {
        await poolBancoDados.execute(
            `INSERT INTO evento
            (data_hora_inicio, status_evento, fk_sensor)
            VALUES (NOW(), ?, ?)`,
            [statusEvento, idSensor]
        );
    }

    // Simulação independente dos sensores 18 a 24
    sensoresSimulados.forEach((sensor) => {
        let congestionado = 0;

        valoresSensores[sensor.id].push(congestionado);

        setInterval(async () => {
            congestionado = congestionado === 1 ? 0 : 1;

            valoresSensores[sensor.id].push(congestionado);

            // Mantém apenas as últimas 100 leituras
            if (valoresSensores[sensor.id].length > 100) {
                valoresSensores[sensor.id].shift();
            }

            console.log(`Sensor ${sensor.id}: ${congestionado}`);

            if (HABILITAR_OPERACAO_INSERIR) {
                const statusEvento = congestionado === 1
                    ? 'Entrada'
                    : 'Saida';

                try {
                    await registrarEvento(sensor.id, statusEvento);
                } catch (erro) {
                    console.error(
                        `Erro no sensor ${sensor.id}:`,
                        erro.message
                    );
                }
            }
        }, sensor.intervalo);
    });

    // Lista as portas seriais disponíveis e procura pelo Arduino
    const portas = await serialport.SerialPort.list();

    const portaArduino = portas.find(
        porta => porta.vendorId == 2341 && porta.productId == 43
    );

    if (!portaArduino) {
        throw new Error('O arduino não foi encontrado em nenhuma porta serial');
    }

    // Configura a porta serial
    const arduino = new serialport.SerialPort({
        path: portaArduino.path,
        baudRate: SERIAL_BAUD_RATE
    });

    arduino.on('open', () => {
        console.log(
            `A leitura do arduino foi iniciada na porta ${portaArduino.path} utilizando Baud Rate de ${SERIAL_BAUD_RATE}`
        );
    });

    // Processa os dados recebidos do Arduino para o sensor 17
    let ultimoEstado = null;

    arduino
        .pipe(new serialport.ReadlineParser({ delimiter: '\r\n' }))
        .on('data', async (data) => {
            console.log(data);

            const sensorDigital = Number(data.trim());

            if (sensorDigital !== 0 && sensorDigital !== 1) {
                console.log('Leitura inválida do Arduino:', data);
                return;
            }

            valoresSensores[17].push(sensorDigital);

            if (valoresSensores[17].length > 100) {
                valoresSensores[17].shift();
            }

            if (
                HABILITAR_OPERACAO_INSERIR &&
                ultimoEstado !== null &&
                sensorDigital !== ultimoEstado
            ) {
                const statusSensor1 = sensorDigital === 1
                    ? 'Entrada'
                    : 'Saida';

                try {
                    await registrarEvento(17, statusSensor1);

                    console.log(
                        'Mudança do Sensor 17:',
                        statusSensor1
                    );
                } catch (erro) {
                    console.error(
                        'Erro ao registrar Sensor 17:',
                        erro.message
                    );
                }
            }

            ultimoEstado = sensorDigital;
        });

    arduino.on('error', (mensagem) => {
        console.error(`Erro no arduino: ${mensagem}`);
    });
};

// Função para criar e configurar o servidor web
const servidor = (valoresSensores) => {
    const app = express();

    app.use((request, response, next) => {
        response.header('Access-Control-Allow-Origin', '*');
        response.header(
            'Access-Control-Allow-Headers',
            'Origin, Content-Type, Accept'
        );
        next();
    });

    app.get('/sensores/:id', (request, response) => {
        const id = Number(request.params.id);

        if (!Object.prototype.hasOwnProperty.call(valoresSensores, id)) {
            return response.status(404).json({
                erro: 'Sensor não encontrado'
            });
        }

        return response.json(valoresSensores[id]);
    });

    app.listen(SERVIDOR_PORTA, () => {
        console.log(
            `API executada com sucesso na porta ${SERVIDOR_PORTA}`
        );
    });
};

// Função principal
(async () => {
    const valoresSensores = {
        17: [],
        18: [],
        19: [],
        20: [],
        21: [],
        22: [],
        23: [],
        24: []
    };

    await serial(valoresSensores);

    servidor(valoresSensores);
})();
