require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dgram = require('dgram');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Verificar si acc-broadcast está disponible
let AccBroadcast = null;
let useOfficialLibrary = false;

try {
  AccBroadcast = require('acc-broadcast');
  useOfficialLibrary = true;
  console.log('✅ Librería acc-broadcast encontrada - Usando protocolo oficial');
  
  // Verificar versión si está disponible
  try {
    const packageInfo = require('acc-broadcast/package.json');
    console.log(`📦 Versión acc-broadcast: ${packageInfo.version}`);
  } catch (e) {
    console.log('📦 acc-broadcast cargada (versión no detectada)');
  }
  
} catch (error) {
  console.log('⚠️ Librería acc-broadcast no encontrada - Usando implementación manual');
  console.log('💡 Para instalar: npm install acc-broadcast');
  console.log('❌ Error específico:', error.message);
}

// Monitor ACC Híbrido - Oficial + Manual
class ACCHybridMonitor {
  constructor() {
    this.port = 9000;
    this.accBroadcast = null;
    this.udpServer = null;
    this.isRunning = false;
    this.isConnected = false;
    this.currentRPM = 0;
    this.currentCar = 'Desconocido';
    this.currentSpeed = 0;
    this.currentGear = 'N';
    this.updateCount = 0;
    this.lastDisplayTime = 0;
    this.useOfficial = useOfficialLibrary;
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Ya está conectado a ACC');
      return;
    }

    console.log('🏎️  MONITOR ACC HÍBRIDO');
    console.log('═'.repeat(60));
    
    if (this.useOfficial) {
      console.log('📡 Usando protocolo oficial acc-broadcast');
      this.startOfficialMonitor();
    } else {
      console.log('📡 Usando implementación manual UDP');
      this.startManualMonitor();
    }
    
    console.log('═'.repeat(60));
    this.isRunning = true;
    return true;
  }

  startOfficialMonitor() {
    try {
      console.log('🔧 Creando conexión ACC Broadcast...');
      this.accBroadcast = new AccBroadcast("RPM Monitor", "asd");
      
      // Debug: Escuchar TODOS los eventos posibles
      this.accBroadcast.on("connect", () => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`\n🎉 [${timestamp}] ¡CONECTADO A ACC!`);
        console.log('✅ Protocolo oficial funcionando');
        this.isConnected = true;
      });

      this.accBroadcast.on("disconnect", () => {
        console.log('\n🔌 Desconectado de ACC');
        this.isConnected = false;
      });

      this.accBroadcast.on("error", (error) => {
        console.log('\n❌ ERROR en acc-broadcast:', error);
      });

      // Eventos de telemetría
      this.accBroadcast.on("realtime_car_update", (update) => {
        console.log('\n📊 REALTIME_CAR_UPDATE recibido!');
        console.log('Datos:', JSON.stringify(update, null, 2));
        this.handleOfficialUpdate(update);
      });

      this.accBroadcast.on("realtime_update", (update) => {
        console.log('\n📊 REALTIME_UPDATE recibido!');
        // Buscar RPM también en este evento
        if (update.RPM || update.Rpms || update.EngineRPM) {
          const foundRPM = update.RPM || update.Rpms || update.EngineRPM;
          console.log(`🎯 RPM encontradas en REALTIME_UPDATE: ${foundRPM}`);
          this.currentRPM = Math.round(foundRPM);
        }
        // Solo mostrar datos si es muy diferente al último
        console.log(`📊 Datos principales: Temp ambiente: ${update.AmbientTemp}°C, Pista: ${update.TrackTemp}°C`);
      });

      this.accBroadcast.on("car_info", (cars) => {
        console.log('\n🚗 CAR_INFO recibido!');
        console.log(`Número de coches: ${cars ? cars.length : 0}`);
        if (cars && cars.length > 0) {
          console.log('Datos del primer coche:', JSON.stringify(cars[0], null, 2));
          const playerCar = cars.find(car => car.isPlayer);
          if (playerCar) {
            this.currentCar = this.getCarModelName(playerCar.carModel);
            console.log(`🏎️ Coche del jugador: ${this.currentCar}`);
          }
        }
      });

      this.accBroadcast.on("session_info", (info) => {
        console.log('\n📋 SESSION_INFO recibido!');
        console.log('Datos:', JSON.stringify(info, null, 2));
      });

      this.accBroadcast.on("leaderboard_update", (leaderboard) => {
        console.log('\n🏆 LEADERBOARD_UPDATE recibido!');
        console.log(`Número de entradas: ${leaderboard ? leaderboard.length : 0}`);
      });

      this.accBroadcast.on("track_data", (track) => {
        console.log('\n🏁 TRACK_DATA recibido!');
        console.log('Datos básicos del circuito recibidos');
      });

      // Buscar eventos de física/telemetría más detallada
      this.accBroadcast.on("physics_update", (physics) => {
        console.log('\n🔬 PHYSICS_UPDATE recibido!');
        if (physics.RPM || physics.Rpms || physics.EngineRPM) {
          const foundRPM = physics.RPM || physics.Rpms || physics.EngineRPM;
          console.log(`🎯 RPM encontradas en PHYSICS: ${foundRPM}`);
          this.currentRPM = Math.round(foundRPM);
        }
        console.log('Datos:', JSON.stringify(physics, null, 2));
      });

      this.accBroadcast.on("car_update", (carData) => {
        console.log('\n🚗 CAR_UPDATE recibido!');
        if (carData.RPM || carData.Rpms || carData.EngineRPM) {
          const foundRPM = carData.RPM || carData.Rpms || carData.EngineRPM;
          console.log(`🎯 RPM encontradas en CAR_UPDATE: ${foundRPM}`);
          this.currentRPM = Math.round(foundRPM);
        }
        console.log('Datos:', JSON.stringify(carData, null, 2));
      });

      // Evento genérico para capturar cualquier cosa
      this.accBroadcast.on("*", (eventName, data) => {
        console.log(`\n🔔 Evento desconocido: ${eventName}`);
        console.log('Datos:', data);
      });

      console.log('📡 Iniciando conexión con ACC...');
      console.log('🔍 Esperando eventos de la librería...');

      // Timeout para verificar conexión
      setTimeout(() => {
        if (!this.isConnected) {
          console.log('\n⚠️ No se ha conectado después de 10 segundos');
          console.log('💡 Posibles problemas:');
          console.log('   • ACC no está abierto o no está en una sesión');
          console.log('   • broadcasting.json mal configurado');
          console.log('   • Puerto 9000 ocupado por otra aplicación');
          console.log('   • Contraseña incorrecta en broadcasting.json');
        }
      }, 10000);

    } catch (error) {
      console.error('❌ Error creando acc-broadcast:', error.message);
      console.log('🔄 Cambiando a modo manual...');
      this.fallbackToManual();
    }
  }

  startManualMonitor() {
    console.log('🔧 Iniciando UDP Server manual...');
    
    this.udpServer = dgram.createSocket('udp4');

    this.udpServer.on('message', (message, remote) => {
      this.handleManualMessage(message, remote);
    });

    this.udpServer.on('listening', () => {
      console.log(`🎧 UDP Server manual activo en puerto ${this.port}`);
      console.log('🔍 Esperando conexión de ACC...');
    });

    this.udpServer.on('error', (error) => {
      console.error('❌ ERROR UDP:', error.message);
    });

    this.udpServer.bind(this.port, '127.0.0.1');
  }

  handleOfficialUpdate(update) {
    try {
      this.updateCount++;
      const timestamp = new Date().toLocaleTimeString();
      
      // Extraer datos disponibles
      this.currentSpeed = Math.round(update.Kmh || 0);
      this.currentGear = update.Gear || 'N';
      
      // Buscar RPM en diferentes campos posibles
      this.currentRPM = Math.round(
        update.Rpms || 
        update.RPM || 
        update.EngineRPM || 
        update.rpm || 
        0
      );
      
      // Si no hay RPM, estimar basándose en velocidad y marcha
      if (this.currentRPM === 0 && this.currentSpeed > 0 && this.currentGear !== 'N') {
        this.currentRPM = this.estimateRPM(this.currentSpeed, this.currentGear);
      }
      
      const now = Date.now();
      if (now - this.lastDisplayTime > 300) {
        console.log(`\n📊 [${timestamp}] TELEMETRÍA OFICIAL #${this.updateCount}`);
        
        // Mostrar todos los datos disponibles
        console.log(`⚡ Velocidad: ${this.currentSpeed} km/h`);
        console.log(`⚙️ Marcha: ${this.currentGear}`);
        
        if (this.currentRPM > 500) {
          console.log(`🔧 RPM: ${this.currentRPM} ${this.currentRPM > 8000 ? '(estimadas)' : ''}`);
          console.log(`🚗 Coche: ${this.currentCar}`);
          this.displayRPMBar();
        } else {
          console.log(`🔧 RPM: ${this.currentRPM} (no disponibles en telemetría)`);
          console.log(`💡 RPM estimadas por velocidad: ~${this.estimateRPM(this.currentSpeed, this.currentGear)}`);
        }
        
        // Mostrar posición y otros datos interesantes
        if (update.Position) console.log(`🏁 Posición: ${update.Position}`);
        if (update.Delta) console.log(`⏱️ Delta: ${update.Delta}ms`);
        if (update.Laps !== undefined) console.log(`🔄 Vueltas: ${update.Laps}`);
        
        console.log('─'.repeat(40));
        this.lastDisplayTime = now;
      }

      this.emitTelemetry();

    } catch (error) {
      console.error('❌ Error procesando telemetría oficial:', error.message);
    }
  }

  // Función para estimar RPM basándose en velocidad y marcha
  estimateRPM(speed, gear) {
    if (speed === 0 || gear === 'N' || gear === 0) return 800; // Ralentí
    
    // Estimación aproximada para coches GT3
    const gearRatios = {
      1: 180,   // 1ª marcha: alta ratio RPM/velocidad
      2: 120,   // 2ª marcha
      3: 90,    // 3ª marcha
      4: 70,    // 4ª marcha
      5: 55,    // 5ª marcha
      6: 45     // 6ª marcha
    };
    
    const ratio = gearRatios[gear] || 60;
    const estimatedRPM = Math.min((speed * ratio) + 800, 8500);
    
    return Math.round(estimatedRPM);
  }

  handleManualMessage(message, remote) {
    try {
      const timestamp = new Date().toLocaleTimeString();
      this.updateCount++;

      let asciiString = '';
      for (let i = 0; i < message.length; i++) {
        const byte = message[i];
        if (byte >= 32 && byte <= 126) {
          asciiString += String.fromCharCode(byte);
        } else {
          asciiString += '.';
        }
      }

      console.log(`\n📨 [${timestamp}] MENSAJE UDP #${this.updateCount}`);
      console.log(`📏 Tamaño: ${message.length} bytes`);

      // Autenticación
      if (asciiString.includes('asd') || asciiString.includes('SimHub')) {
        console.log('🔐 AUTENTICACIÓN DETECTADA');
        this.isConnected = true;
        
        const response = Buffer.from([1, 0, 0, 0]);
        this.udpServer.send(response, 0, response.length, remote.port, remote.address);
        console.log('✅ AUTENTICADO');
        console.log('─'.repeat(40));
        return;
      }

      // Telemetría
      if (this.isConnected && message.length > 20) {
        console.log('📦 DATOS DE TELEMETRÍA MANUAL');
        this.processManualTelemetry(message);
        console.log('─'.repeat(40));
        return;
      }

      // Heartbeat
      if (message.length <= 10) {
        console.log('💓 Heartbeat');
        console.log('─'.repeat(20));
      }

    } catch (error) {
      console.error('❌ Error procesando mensaje manual:', error.message);
    }
  }

  processManualTelemetry(buffer) {
    const now = Date.now();
    if (now - this.lastDisplayTime < 300) return; // Evitar spam
    
    console.log('📦 ANALIZANDO TELEMETRÍA MANUAL');
    console.log(`📏 Tamaño del buffer: ${buffer.length} bytes`);
    
    // Buscar RPM en diferentes formatos
    let foundRPM = false;
    let foundValues = [];
    
    // 1. Buscar como float de 32 bits
    for (let i = 0; i <= buffer.length - 4; i += 4) {
      try {
        const floatValue = buffer.readFloatLE(i);
        if (Number.isFinite(floatValue) && !Number.isNaN(floatValue)) {
          if (floatValue >= 500 && floatValue <= 12000) {
            foundValues.push({ offset: i, value: floatValue, type: 'FLOAT', likely: 'RPM' });
          } else if (floatValue >= 0 && floatValue <= 400) {
            foundValues.push({ offset: i, value: floatValue, type: 'FLOAT', likely: 'VELOCIDAD' });
          } else if (floatValue > 0 && floatValue < 100) {
            foundValues.push({ offset: i, value: floatValue, type: 'FLOAT', likely: 'OTROS' });
          }
        }
      } catch (e) {}
    }
    
    // 2. Buscar como entero de 16 bits
    for (let i = 0; i <= buffer.length - 2; i += 2) {
      try {
        const shortValue = buffer.readUInt16LE(i);
        if (shortValue >= 500 && shortValue <= 12000) {
          foundValues.push({ offset: i, value: shortValue, type: 'INT16', likely: 'RPM' });
        }
      } catch (e) {}
    }
    
    // 3. Mostrar todos los valores encontrados
    console.log('🔍 VALORES ENCONTRADOS:');
    foundValues.forEach(item => {
      console.log(`   Offset ${item.offset.toString().padStart(3)}: ${item.value.toFixed(2)} (${item.type}) - ${item.likely} ${item.likely === 'RPM' ? '⭐' : ''}`);
    });
    
    // 4. Seleccionar el valor más probable para RPM
    const rpmCandidates = foundValues.filter(item => item.likely === 'RPM');
    
    if (rpmCandidates.length > 0) {
      // Tomar el primer candidato a RPM
      const bestRPM = rpmCandidates[0];
      this.currentRPM = Math.round(bestRPM.value);
      console.log(`🎯 RPM SELECCIONADAS: ${this.currentRPM} (offset ${bestRPM.offset}, ${bestRPM.type})`);
      
      // Buscar velocidad también
      const speedCandidates = foundValues.filter(item => item.likely === 'VELOCIDAD');
      if (speedCandidates.length > 0) {
        this.currentSpeed = Math.round(speedCandidates[0].value);
        console.log(`🏃 VELOCIDAD: ${this.currentSpeed} km/h`);
      }
      
      this.displayRPMBar();
      foundRPM = true;
    }

    if (!foundRPM) {
      console.log('❌ No se encontraron RPM válidas');
      console.log('🔍 Mostrando contenido raw del buffer:');
      
      // Mostrar hex
      const hexPart = buffer.slice(0, Math.min(64, buffer.length))
                           .toString('hex')
                           .match(/.{2}/g)
                           .join(' ');
      console.log(`   HEX: ${hexPart}${buffer.length > 64 ? '...' : ''}`);
      
      // Mostrar algunos valores float sin filtro
      console.log('   TODOS LOS FLOATS (primeros 16):');
      for (let i = 0; i <= Math.min(buffer.length - 4, 64); i += 4) {
        try {
          const floatVal = buffer.readFloatLE(i);
          if (Number.isFinite(floatVal) && !Number.isNaN(floatVal)) {
            console.log(`     ${i.toString().padStart(2)}: ${floatVal.toFixed(3)}`);
          }
        } catch (e) {}
      }
    }

    this.emitTelemetry();
    this.lastDisplayTime = now;
  }

  debugBuffer(buffer) {
    console.log('🔍 DEBUG - Valores candidatos:');
    for (let i = 0; i <= Math.min(buffer.length - 4, 32); i += 4) {
      try {
        const floatVal = buffer.readFloatLE(i);
        if (Number.isFinite(floatVal) && floatVal > 0) {
          let desc = '';
          if (floatVal >= 500 && floatVal <= 12000) desc = '← POSIBLE RPM ⭐';
          else if (floatVal >= 0 && floatVal <= 400) desc = '← Posible velocidad';
          console.log(`   ${i.toString().padStart(2)}: ${floatVal.toFixed(2)} ${desc}`);
        }
      } catch (e) {}
    }
  }

  displayRPMBar() {
    if (this.currentRPM <= 0) return;

    const maxRPM = 8000;
    const barLength = 35;
    const filled = Math.min(this.currentRPM / maxRPM, 1);
    const filledLength = Math.round(barLength * filled);
    
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    let color = '';
    if (this.currentRPM < 2000) color = '\x1b[32m';
    else if (this.currentRPM < 5000) color = '\x1b[33m';
    else if (this.currentRPM < 7000) color = '\x1b[31m';
    else color = '\x1b[35m';
    
    const reset = '\x1b[0m';
    console.log(`📈 ${color}${this.currentRPM.toString().padStart(5)} RPM${reset} |${bar}|`);
  }

  emitTelemetry() {
    io.emit('telemetry_update', {
      rpm: this.currentRPM,
      speed: this.currentSpeed,
      gear: this.currentGear,
      car: this.currentCar,
      timestamp: new Date(),
      protocol: this.useOfficial ? 'official' : 'manual'
    });
  }

  getCarModelName(carModelId) {
    const carModels = {
      0: 'Porsche 991 GT3 R',
      1: 'Mercedes-AMG GT3',
      2: 'Ferrari 488 GT3',
      3: 'Audi R8 LMS',
      4: 'Lamborghini Huracán GT3',
      12: 'Porsche 991II GT3 R',
      23: 'Porsche 992 GT3 Cup',
      25: 'BMW M4 GT3',
      // Agregar más según necesidad
    };
    
    return carModels[carModelId] || `Coche ID: ${carModelId}`;
  }

  fallbackToManual() {
    console.log('🔄 Cambiando a modo manual...');
    this.useOfficial = false;
    this.startManualMonitor();
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.isConnected = false;

    if (this.accBroadcast) {
      this.accBroadcast.disconnect();
      this.accBroadcast = null;
    }

    if (this.udpServer) {
      this.udpServer.close();
      this.udpServer = null;
    }

    console.log('🛑 Monitor detenido');
  }

  getCurrentData() {
    return {
      rpm: this.currentRPM,
      speed: this.currentSpeed,
      gear: this.currentGear,
      car: this.currentCar,
      timestamp: new Date(),
      isRunning: this.isRunning,
      isConnected: this.isConnected,
      protocol: this.useOfficial ? 'official' : 'manual'
    };
  }
}

// Variables globales
let accMonitor = null;
let isListening = false;

function initializeMonitor() {
  accMonitor = new ACCHybridMonitor();
}

// RUTAS DE LA API
app.post('/api/start', (req, res) => {
  try {
    if (isListening) {
      return res.json({ message: 'Ya está conectado a ACC' });
    }

    if (!accMonitor) {
      initializeMonitor();
    }
    
    if (accMonitor.start()) {
      isListening = true;
      res.json({ message: 'Monitor ACC iniciado' });
    } else {
      res.status(500).json({ error: 'Error iniciando monitor' });
    }
  } catch (error) {
    console.error('Error iniciando:', error);
    res.status(500).json({ error: 'Error iniciando monitor' });
  }
});

app.post('/api/stop', (req, res) => {
  try {
    if (!isListening) {
      return res.json({ message: 'No hay monitor activo' });
    }

    accMonitor.stop();
    isListening = false;
    res.json({ message: 'Monitor detenido' });
  } catch (error) {
    console.error('Error deteniendo:', error);
    res.status(500).json({ error: 'Error deteniendo monitor' });
  }
});

app.get('/api/telemetry', (req, res) => {
  const data = accMonitor ? accMonitor.getCurrentData() : {
    rpm: 0,
    speed: 0,
    gear: 'N',
    car: 'Desconocido',
    timestamp: new Date(),
    isRunning: false,
    isConnected: false,
    protocol: 'none'
  };
  
  res.json(data);
});

// Servir archivos estáticos
app.use(express.static('public'));

// Inicialización
console.log('🚀 Iniciando Monitor ACC Híbrido...');
initializeMonitor();

// Auto-start
setTimeout(() => {
  if (accMonitor && !isListening) {
    console.log('🚀 Iniciando monitor automáticamente...');
    if (accMonitor.start()) {
      isListening = true;
      console.log('✅ Monitor iniciado');
      
      setTimeout(() => {
        console.log('');
        console.log('📋 INSTRUCCIONES:');
        console.log('   1. Abre ACC y ve a una sesión activa');
        console.log('   2. Enciende el motor y acelera');
        console.log('   3. Deberías ver RPM y datos del coche');
        console.log('');
        
        if (useOfficialLibrary) {
          console.log('🔧 USANDO LIBRERÍA OFICIAL:');
          console.log('   • Si no se conecta, verifica:');
          console.log('   • ACC debe estar EN UNA SESIÓN (no en menús)');
          console.log('   • broadcasting.json debe tener password "asd"');
          console.log('   • Puerto 9000 debe estar libre');
        } else {
          console.log('💡 RECOMENDACIÓN:');
          console.log('   Para mejor compatibilidad instala:');
          console.log('   npm install acc-broadcast');
        }
        console.log('');
      }, 2000);
    }
  }
}, 1000);

// Manejo de cierre
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  if (accMonitor && isListening) {
    accMonitor.stop();
  }
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 Monitor ACC Híbrido - ${useOfficialLibrary ? 'Protocolo Oficial' : 'UDP Manual'}`);
  console.log(`🌐 API disponible en: http://localhost:${PORT}/api/telemetry`);
  console.log(`💡 Presiona Ctrl+C para salir`);
});