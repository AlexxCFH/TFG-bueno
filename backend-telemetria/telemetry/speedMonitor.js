const dgram = require('dgram');
const readline = require('readline');

class ACCSpeedMonitor {
  constructor() {
    this.port = 9996;
    this.udpSocket = null;
    this.isRunning = false;
    this.gameRunning = false;
    this.dataTimeout = null;
    this.timeoutDuration = 5000; // 5 segundos sin datos = juego desconectado
    this.connectionId = Math.floor(Math.random() * 1000);
    this.lastSpeed = 0;
    this.updateCount = 0;
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Ya está monitoreando velocidad');
      return;
    }

    console.clear();
    console.log('🏎️  MONITOR DE VELOCIDAD - ASSETTO CORSA COMPETIZIONE');
    console.log('═'.repeat(60));
    console.log('');
    console.log('📋 CONFIGURACIÓN REQUERIDA EN ACC:');
    console.log('   1. Abre ACC → Configuración → Sistema');
    console.log('   2. Busca "Broadcasting" o "UDP Output"');
    console.log('   3. Configura:');
    console.log('      • Host: 127.0.0.1');
    console.log('      • Port: 9996');
    console.log('      • Update Rate: 10ms');
    console.log('      • Habilitar: ON');
    console.log('   4. Reinicia ACC y entra en sesión');
    console.log('');
    console.log('⚡ O usa SimHub/CrewChief (configuración automática)');
    console.log('');
    console.log('═'.repeat(60));
    console.log('');

    this.isRunning = true;
    this.setupUDPSocket();
    this.setupKeyboardInput();
  }

  setupUDPSocket() {
    this.udpSocket = dgram.createSocket('udp4');

    this.udpSocket.on('listening', () => {
      const address = this.udpSocket.address();
      console.log(`📡 Escuchando en ${address.address}:${address.port}`);
      console.log('🔍 Esperando datos de ACC...');
      console.log('');
      this.requestConnection();
    });

    this.udpSocket.on('message', (message, remote) => {
      this.handleUDPMessage(message, remote);
    });

    this.udpSocket.on('error', (error) => {
      console.error('❌ Error UDP:', error.message);
      if (error.code === 'EADDRINUSE') {
        console.log('⚠️ Puerto 9996 ocupado. Probando 9997...');
        this.port = 9997;
        setTimeout(() => this.setupUDPSocket(), 1000);
      }
    });

    try {
      this.udpSocket.bind(this.port, '127.0.0.1');
    } catch (error) {
      console.error('❌ Error al abrir puerto:', error.message);
    }
  }

  requestConnection() {
    if (!this.udpSocket) return;

    try {
      const connectionRequest = Buffer.alloc(8);
      connectionRequest.writeUInt32LE(1, 0); // REQUEST_CONNECTION
      connectionRequest.writeUInt32LE(this.connectionId, 4);

      this.udpSocket.send(connectionRequest, 9995, '127.0.0.1', (error) => {
        if (!error) {
          console.log('📤 Solicitud de conexión enviada');
        }
      });
    } catch (error) {
      // Silencioso si falla
    }
  }

  handleUDPMessage(message, remote) {
    try {
      if (!this.gameRunning) {
        this.gameRunning = true;
        console.log('🎮 ¡ACC CONECTADO!');
        console.log(`📊 Recibiendo datos desde: ${remote.address}:${remote.port}`);
        console.log('');
        console.log('🏁 VELOCIDAD EN TIEMPO REAL:');
        console.log('─'.repeat(50));
      }

      // Resetear timeout de desconexión
      if (this.dataTimeout) {
        clearTimeout(this.dataTimeout);
      }

      this.dataTimeout = setTimeout(() => {
        if (this.gameRunning) {
          this.gameRunning = false;
          console.log('');
          console.log('🎮 ACC DESCONECTADO - Sin datos');
          console.log('🔍 Esperando reconexión...');
        }
      }, this.timeoutDuration);

      // Parsear velocidad
      const speed = this.parseSpeed(message);
      if (speed !== null) {
        this.displaySpeed(speed);
      }

    } catch (error) {
      // Error silencioso
    }
  }

  parseSpeed(buffer) {
    if (buffer.length < 4) return null;

    try {
      // Obtener tipo de mensaje
      const messageType = buffer.readUInt8(0);

      switch (messageType) {
        case 1: // REALTIME_UPDATE
          return this.parseRealtimeSpeed(buffer);
        case 2: // CAR_UPDATE
          return this.parseCarSpeed(buffer);
        default:
          return this.parseGenericSpeed(buffer);
      }
    } catch (error) {
      return null;
    }
  }

  parseCarSpeed(buffer) {
    try {
      if (buffer.length < 10) return null;
      
      // Saltar carId (2 bytes)
      const speed = buffer.readFloatLE(3);
      
      if (speed >= 0 && speed <= 400) {
        return speed;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  parseRealtimeSpeed(buffer) {
    try {
      // Para REALTIME_UPDATE, buscar en posiciones comunes
      const positions = [8, 12, 16, 20, 24];
      
      for (const pos of positions) {
        if (buffer.length >= pos + 4) {
          const speed = buffer.readFloatLE(pos);
          if (speed >= 0 && speed <= 400) {
            return speed;
          }
        }
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  parseGenericSpeed(buffer) {
    try {
      // Buscar velocidad en múltiples posiciones
      const positions = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40];
      
      for (const pos of positions) {
        if (buffer.length >= pos + 4) {
          const speed = buffer.readFloatLE(pos);
          if (speed > 0 && speed <= 400) {
            return speed;
          }
        }
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  displaySpeed(speed) {
    // Convertir a km/h si parece estar en m/s
    let speedKmh = speed;
    if (speed < 200 && speed > 0) {
      speedKmh = speed * 3.6; // Probablemente en m/s
    }
    
    speedKmh = Math.round(speedKmh * 10) / 10; // 1 decimal

    // Solo mostrar si hay cambio significativo
    if (Math.abs(speedKmh - this.lastSpeed) > 0.5) {
      this.lastSpeed = speedKmh;
      this.updateCount++;

      // Barra de progreso visual
      const maxSpeed = 300;
      const barLength = 30;
      const filled = Math.min(speedKmh / maxSpeed, 1);
      const filledLength = Math.round(barLength * filled);
      
      const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
      
      // Color basado en velocidad
      let color = '';
      if (speedKmh < 50) color = '\x1b[32m'; // Verde
      else if (speedKmh < 150) color = '\x1b[33m'; // Amarillo
      else color = '\x1b[31m'; // Rojo
      
      const reset = '\x1b[0m';
      const timestamp = new Date().toLocaleTimeString();
      
      // Limpiar línea y mostrar velocidad
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      process.stdout.write(
        `[${timestamp}] ${color}${speedKmh.toString().padStart(6)} km/h${reset} |${bar}| #${this.updateCount}`
      );
    }
  }

  setupKeyboardInput() {
    // Configurar input para salir con 'q' o Ctrl+C
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on('keypress', (str, key) => {
      if (key && ((key.ctrl && key.name === 'c') || key.name === 'q')) {
        this.stop();
        process.exit(0);
      }
    });

    console.log('💡 Presiona [Q] o [Ctrl+C] para salir');
    console.log('');
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.gameRunning = false;

    if (this.dataTimeout) {
      clearTimeout(this.dataTimeout);
    }

    if (this.udpSocket) {
      this.udpSocket.close();
    }

    console.log('');
    console.log('');
    console.log('🛑 Monitor detenido');
    console.log('👋 ¡Gracias por usar el monitor de velocidad!');
  }

  // Método para obtener estado (compatible con tu código existente)
  getStatus() {
    return {
      isRunning: this.isRunning,
      gameDetected: this.gameRunning,
      port: this.port,
      lastSpeed: this.lastSpeed,
      updateCount: this.updateCount
    };
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const monitor = new ACCSpeedMonitor();
  
  // Manejar cierre limpio
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    monitor.stop();
    process.exit(0);
  });

  // Iniciar monitor
  monitor.start();
}

module.exports = ACCSpeedMonitor;