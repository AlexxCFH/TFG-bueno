const EventEmitter = require('events');
const dgram = require('dgram');

class UDPBroadcastReader extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.udpSocket = null;
    this.port = 9996; // Puerto estándar de ACC
    this.lastValidData = null;
    this.gameRunning = false;
    this.dataTimeout = null;
    this.timeoutDuration = 5000; // 5 segundos sin datos = juego desconectado
    
    this.connectionRegistered = false;
    this.connectionId = Math.floor(Math.random() * 1000);
  }

  // Iniciar captura UDP
  start() {
    if (this.isRunning) {
      console.log('⚠️ Ya está capturando datos UDP');
      return;
    }

    this.isRunning = true;
    console.log('🏁 Iniciando captura UDP Broadcast de ACC...');
    console.log('');
    console.log('📋 CONFIGURACIÓN REQUERIDA EN ACC:');
    console.log('   1. Abre ACC');
    console.log('   2. Ve a Configuración → Sistema');
    console.log('   3. Busca "Broadcasting" o "UDP Output"');
    console.log('   4. Configura:');
    console.log('      - Host: 127.0.0.1');
    console.log('      - Port: 9996');
    console.log('      - Realtime Update Rate: 10ms');
    console.log('      - Habilitar: ON');
    console.log('   5. Reinicia ACC y entra en una sesión');
    console.log('');
    console.log('⚡ También puedes usar aplicaciones como:');
    console.log('   - SimHub (automático)');
    console.log('   - CrewChief (automático)');
    console.log('   - ACC LiveryEditor (automático)');
    console.log('');
    
    this.setupUDPSocket();
    this.emit('started');
  }

  // Configurar socket UDP
  setupUDPSocket() {
    this.udpSocket = dgram.createSocket('udp4');

    this.udpSocket.on('listening', () => {
      const address = this.udpSocket.address();
      console.log(`📡 Escuchando UDP en ${address.address}:${address.port}`);
      console.log('🔍 Esperando datos de ACC...');
      
      // Enviar solicitud de conexión a ACC (si está configurado para recibirlas)
      this.requestConnection();
    });

    this.udpSocket.on('message', (message, remote) => {
      this.handleUDPMessage(message, remote);
    });

    this.udpSocket.on('error', (error) => {
      console.error('❌ Error UDP:', error);
      if (error.code === 'EADDRINUSE') {
        console.log('⚠️ Puerto 9996 en uso. Intentando puerto 9997...');
        this.port = 9997;
        setTimeout(() => this.setupUDPSocket(), 1000);
      } else {
        this.emit('error', error);
      }
    });

    // Bind al puerto
    try {
      this.udpSocket.bind(this.port, '127.0.0.1');
    } catch (error) {
      console.error('❌ Error binding UDP:', error);
      this.emit('error', error);
    }
  }

  // Solicitar conexión a ACC
  requestConnection() {
    if (!this.udpSocket || this.connectionRegistered) return;

    try {
      // Crear mensaje de solicitud de conexión
      const connectionRequest = Buffer.alloc(8);
      connectionRequest.writeUInt32LE(1, 0); // Message type: REQUEST_CONNECTION
      connectionRequest.writeUInt32LE(this.connectionId, 4); // Connection ID

      // Enviar a ACC (puerto por defecto)
      this.udpSocket.send(connectionRequest, 9995, '127.0.0.1', (error) => {
        if (!error) {
          console.log('📤 Solicitud de conexión enviada a ACC');
        }
      });
    } catch (error) {
      console.log('⚠️ No se pudo enviar solicitud de conexión:', error.message);
    }
  }

  // Manejar mensajes UDP de ACC
  handleUDPMessage(message, remote) {
    try {
      // ACC está enviando datos
      if (!this.gameRunning) {
        this.gameRunning = true;
        console.log('🎮 ¡ACC CONECTADO! - Recibiendo datos UDP');
        console.log(`📊 Datos desde: ${remote.address}:${remote.port}`);
        this.emit('gameDetected');
      }

      // Resetear timeout
      if (this.dataTimeout) {
        clearTimeout(this.dataTimeout);
      }

      // Configurar nuevo timeout
      this.dataTimeout = setTimeout(() => {
        if (this.gameRunning) {
          this.gameRunning = false;
          console.log('🎮 ACC desconectado - Sin datos UDP');
          this.emit('gameNotDetected');
        }
      }, this.timeoutDuration);

      // Parsear datos UDP
      const telemetryData = this.parseACCBroadcastPacket(message);
      
      if (telemetryData) {
        this.lastValidData = telemetryData;
        this.emit('telemetryData', telemetryData);
      }

    } catch (error) {
      console.error('Error procesando mensaje UDP:', error);
    }
  }

  // Parsear paquete de broadcast de ACC
  parseACCBroadcastPacket(buffer) {
    try {
      if (buffer.length < 32) {
        return null; // Paquete muy pequeño
      }

      let offset = 0;

      // Leer tipo de mensaje
      const messageType = buffer.readUInt8(offset);
      offset += 1;

      // Diferentes tipos de mensajes de ACC
      switch (messageType) {
        case 0: // REGISTRATION_RESULT
          this.handleRegistrationResult(buffer, offset);
          return null;
          
        case 1: // REALTIME_UPDATE
          return this.parseRealtimeUpdate(buffer, offset);
          
        case 2: // REALTIME_CAR_UPDATE  
          return this.parseCarUpdate(buffer, offset);
          
        case 3: // ENTRY_LIST
          this.handleEntryList(buffer, offset);
          return null;
          
        case 4: // TRACK_DATA
          this.handleTrackData(buffer, offset);
          return null;
          
        case 5: // ENTRY_LIST_CAR
          return this.parseEntryListCar(buffer, offset);
          
        default:
          // Tipo de mensaje desconocido, intentar parseo genérico
          return this.parseGenericTelemetry(buffer);
      }

    } catch (error) {
      console.error('Error parseando paquete ACC:', error);
      return null;
    }
  }

  // Parsear actualización en tiempo real
  parseRealtimeUpdate(buffer, offset) {
    try {
      // Event Time
      const eventTime = buffer.readUInt32LE(offset);
      offset += 4;

      // Session Type
      const sessionType = buffer.readUInt8(offset);
      offset += 1;

      // Session Time
      const sessionTime = buffer.readFloatLE(offset);
      offset += 4;

      return {
        timestamp: new Date(),
        speed: 0, // Se actualizará con car update
        car: 'ACC Vehicle (Broadcast)',
        eventTime: eventTime,
        sessionType: this.getSessionTypeName(sessionType),
        sessionTime: sessionTime,
        gameRunning: true,
        source: 'UDP-Broadcast-Realtime'
      };

    } catch (error) {
      return null;
    }
  }

  // Parsear actualización de coche
  parseCarUpdate(buffer, offset) {
    try {
      // Car ID
      const carId = buffer.readUInt16LE(offset);
      offset += 2;

      // Velocidad (km/h)
      const speed = buffer.readFloatLE(offset);
      offset += 4;

      // RPM
      const rpm = buffer.readFloatLE(offset);
      offset += 4;

      // Marcha
      const gear = buffer.readUInt8(offset);
      offset += 1;

      // Posición
      const posX = buffer.readFloatLE(offset);
      offset += 4;
      const posY = buffer.readFloatLE(offset);
      offset += 4;
      const posZ = buffer.readFloatLE(offset);
      offset += 4;

      return {
        timestamp: new Date(),
        speed: Math.max(0, Math.round(speed * 10) / 10),
        car: `ACC Car #${carId}`,
        rpm: Math.round(rpm),
        gear: gear,
        position: { x: posX, y: posY, z: posZ },
        carId: carId,
        gameRunning: true,
        source: 'UDP-Broadcast-Car'
      };

    } catch (error) {
      return null;
    }
  }

  // Parsear entrada de coche
  parseEntryListCar(buffer, offset) {
    try {
      // Car ID
      const carId = buffer.readUInt16LE(offset);
      offset += 2;

      // Car Model (1 byte)
      const carModel = buffer.readUInt8(offset);
      offset += 1;

      // Team Name (wide string - los primeros 50 chars)
      const teamName = this.readWideString(buffer, offset, 50);
      offset += 100; // 50 * 2 bytes

      return {
        timestamp: new Date(),
        speed: 0,
        car: this.getCarModelName(carModel) || `ACC Car Model ${carModel}`,
        teamName: teamName,
        carId: carId,
        gameRunning: true,
        source: 'UDP-Broadcast-Entry'
      };

    } catch (error) {
      return null;
    }
  }

  // Parsear telemetría genérica
  parseGenericTelemetry(buffer) {
    try {
      // Intentar extraer velocidad de posiciones comunes
      let speed = 0;
      
      // Probar diferentes posiciones donde podría estar la velocidad
      const positions = [4, 8, 12, 16, 20, 24, 28, 32];
      
      for (const pos of positions) {
        if (buffer.length >= pos + 4) {
          const testSpeed = buffer.readFloatLE(pos);
          if (testSpeed > 0 && testSpeed < 400) { // Velocidad razonable
            speed = testSpeed;
            break;
          }
        }
      }

      return {
        timestamp: new Date(),
        speed: Math.max(0, Math.round(speed * 10) / 10),
        car: 'ACC Vehicle (Generic)',
        gameRunning: true,
        source: 'UDP-Generic'
      };

    } catch (error) {
      return null;
    }
  }

  // Leer wide string desde buffer
  readWideString(buffer, offset, maxLength) {
    try {
      const stringBuffer = buffer.slice(offset, offset + (maxLength * 2));
      return stringBuffer.toString('utf16le').replace(/\0/g, '').trim();
    } catch (error) {
      return 'Unknown';
    }
  }

  // Obtener nombre del tipo de sesión
  getSessionTypeName(sessionType) {
    const types = {
      0: 'Practice',
      1: 'Qualifying', 
      2: 'Race',
      3: 'Hotlap',
      4: 'Time Attack',
      5: 'Drift',
      6: 'Drag',
      7: 'Hotstint',
      8: 'Hotlap Superpole'
    };
    return types[sessionType] || `Session ${sessionType}`;
  }

  // Obtener nombre del modelo de coche
  getCarModelName(carModel) {
    const models = {
      0: 'Porsche 991 GT3 R',
      1: 'Mercedes-AMG GT3',
      2: 'Ferrari 488 GT3',
      3: 'Audi R8 LMS',
      4: 'Lamborghini Huracán GT3',
      5: 'McLaren 650S GT3',
      6: 'Nissan GT-R Nismo GT3',
      7: 'BMW M6 GT3',
      8: 'Bentley Continental GT3',
      9: 'Porsche 991.2 GT3 Cup',
      10: 'Nissan GT-R Nismo GT3',
      11: 'Bentley Continental GT3',
      12: 'AMR V12 Vantage GT3',
      13: 'Reiter Engineering R-EX GT3',
      14: 'Emil Frey Jaguar G3',
      15: 'Lexus RC F GT3',
      16: 'Lamborghini Huracan GT3 Evo',
      17: 'Honda NSX GT3',
      18: 'Lamborghini Huracan SuperTrofeo',
      19: 'Audi R8 LMS Evo',
      20: 'AMR V8 Vantage',
      21: 'Honda NSX GT3 Evo',
      22: 'McLaren 720S GT3',
      23: 'Porsche 991.2 GT3 R',
      24: 'Ferrari 488 GT3 Evo',
      25: 'Mercedes-AMG GT3',
      26: 'Ferrari 488 Challenge Evo',
      27: 'BMW M2 CS Racing',
      28: 'Porsche 992 GT3 Cup',
      29: 'Lamborghini Huracán SuperTrofeo EVO2',
      30: 'BMW M4 GT3',
      31: 'Audi R8 LMS GT3 evo II'
    };
    return models[carModel];
  }

  // Manejar resultado de registro
  handleRegistrationResult(buffer, offset) {
    try {
      const connectionId = buffer.readUInt32LE(offset);
      const success = buffer.readUInt8(offset + 4);
      
      if (success && connectionId === this.connectionId) {
        this.connectionRegistered = true;
        console.log('✅ Registro exitoso con ACC');
      }
    } catch (error) {
      console.log('⚠️ Error en registro:', error.message);
    }
  }

  // Manejar lista de entrada
  handleEntryList(buffer, offset) {
    console.log('📋 Lista de entrada recibida de ACC');
  }

  // Manejar datos de pista
  handleTrackData(buffer, offset) {
    console.log('🏁 Datos de pista recibidos de ACC');
  }

  // Detener captura
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.dataTimeout) {
      clearTimeout(this.dataTimeout);
      this.dataTimeout = null;
    }
    
    if (this.udpSocket) {
      this.udpSocket.close();
      this.udpSocket = null;
    }
    
    this.gameRunning = false;
    this.connectionRegistered = false;
    console.log('🛑 Deteniendo captura UDP');
    this.emit('stopped');
  }

  // Verificar si ACC está enviando datos
  isACCRunning() {
    return this.gameRunning;
  }

  // Obtener información de estado
  getStatus() {
    return {
      isRunning: this.isRunning,
      gameDetected: this.gameRunning,
      accRunning: this.isACCRunning(),
      port: this.port,
      connected: this.connectionRegistered,
      lastData: this.lastValidData ? {
        speed: this.lastValidData.speed,
        car: this.lastValidData.car,
        timestamp: this.lastValidData.timestamp,
        source: this.lastValidData.source
      } : null
    };
  }
}

module.exports = UDPBroadcastReader;