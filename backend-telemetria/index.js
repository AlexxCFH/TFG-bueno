require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

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

// Verificar librería acc-broadcast
let AccBroadcast = null;
let libraryAvailable = false;

try {
  AccBroadcast = require('acc-broadcast');
  libraryAvailable = true;
  console.log('✅ Librería acc-broadcast encontrada - Usando protocolo oficial');
  
  try {
    const packageInfo = require('acc-broadcast/package.json');
    console.log(`📦 Versión acc-broadcast: ${packageInfo.version}`);
  } catch (e) {
    console.log('📦 acc-broadcast cargada (versión no detectada)');
  }
  
} catch (error) {
  console.log('❌ ERROR: Librería acc-broadcast NO encontrada');
  console.log('💡 Para instalar: npm install acc-broadcast');
  console.log('🚫 Esta aplicación SOLO funciona con la librería oficial');
  console.log('❌ Error específico:', error.message);
}

// Monitor ACC - Solo Librería Oficial
class ACCOfficialMonitor {
  constructor() {
    this.accBroadcast = null;
    this.isRunning = false;
    this.isConnected = false;
    this.updateCount = 0;
    this.lastDisplayTime = 0;
    
    // === DATOS DEL COCHE ===
    // Información básica del coche
    this.carInfo = {
      carModel: 'Desconocido',
      carModelId: null,
      teamName: '',
      raceNumber: 0,
      cupCategory: '',
      nationality: ''
    };
    
    // Información del piloto actual
    this.driverInfo = {
      firstName: '',
      lastName: '',
      shortName: '',
      category: '',
      nationality: ''
    };
    
    // Telemetría en tiempo real (del evento realtime_car_update)
    this.realtimeData = {
      speed: 0,              // Kmh
      gear: 'N',             // Gear  
      position: 0,           // Position
      cupPosition: 0,        // CupPosition
      trackPosition: 0,      // TrackPosition
      splinePosition: 0,     // SplinePosition (0-1)
      laps: 0,               // Laps
      delta: 0,              // Delta (ms)
      carLocation: 0,        // CarLocation (Track=1, Pitlane=2, etc.)
      worldPosX: 0,          // WorldPosX
      worldPosY: 0,          // WorldPosY
      yaw: 0,                // Yaw
      carIndex: 0,           // CarIndex
      driverIndex: 0,        // DriverIndex
      driverCount: 0         // DriverCount
    };
    
    // Datos de vueltas
    this.lapData = {
      bestSessionLap: {
        laptimeMS: null,
        splits: [null, null, null],
        isValid: false,
        isInvalid: false
      },
      lastLap: {
        laptimeMS: null,
        splits: [null, null, null],
        isValid: false,
        isInvalid: false
      },
      currentLap: {
        laptimeMS: null,
        splits: [null, null, null],
        isValid: false,
        isInvalid: false
      }
    };
    
    // Datos de sesión (del evento realtime_update)
    this.sessionData = {
      eventIndex: 0,
      sessionIndex: 0,
      sessionType: 0,        // RaceSessionType
      phase: 0,              // SessionPhase
      sessionTime: 0,        // Tiempo de sesión
      sessionEndTime: 0,     // Tiempo fin sesión
      focusedCarIndex: 0,    // Coche enfocado
      activeCameraSet: '',   // Set de cámaras activo
      activeCamera: '',      // Cámara activa
      currentHudPage: '',    // Página HUD actual
      isReplayPlaying: false, // Reproduciendo replay
      timeOfDay: 0,          // Hora del día
      ambientTemp: 0,        // Temperatura ambiente
      trackTemp: 0,          // Temperatura pista
      clouds: 0,             // Nubes (0-1)
      rainLevel: 0,          // Lluvia (0-1)
      wetness: 0             // Humedad (0-1)
    };
    
    // Datos del circuito
    this.trackData = {
      trackName: '',
      trackId: 0,
      trackMeters: 0,
      cameraSets: {},
      hudPages: []
    };
    
    // Eventos de broadcasting
    this.lastEvent = null;
  }

  start() {
    if (!libraryAvailable) {
      console.log('❌ No se puede iniciar - Librería acc-broadcast no disponible');
      return false;
    }
    
    if (this.isRunning) {
      console.log('⚠️ Ya está conectado a ACC');
      return true;
    }

    console.log('🏎️  MONITOR ACC - PROTOCOLO OFICIAL CORREGIDO');
    console.log('═'.repeat(70));
    console.log('📡 Iniciando conexión con eventos oficiales...');
    
    this.startOfficialMonitor();
    this.isRunning = true;
    return true;
  }

  startOfficialMonitor() {
    try {
      console.log('🔧 Creando conexión ACC Broadcast...');
      this.accBroadcast = new AccBroadcast("ACC Complete Monitor", "asd");
      
      // Configurar todos los eventos OFICIALES según la documentación
      this.setupBroadcastEvents();

      console.log('📡 Conexión iniciada - Esperando respuesta de ACC...');
      console.log('🎮 Asegúrate de que ACC esté abierto y en una sesión activa');

      // Verificación de conexión
      setTimeout(() => {
        if (!this.isConnected) {
          console.log('\n⚠️ Sin conexión después de 5 segundos');
          console.log('🔍 Diagnóstico:');
          console.log('   • ¿Está ACC abierto?');
          console.log('   • ¿Estás EN UNA SESIÓN activa? (no en menús)');
          console.log('   • ¿Existe el archivo broadcasting.json?');
          console.log('   • ¿Tiene la contraseña correcta ("asd")?');
          console.log('');
          console.log('📁 Ubicación del archivo:');
          console.log('   Documents\\Assetto Corsa Competizione\\Config\\broadcasting.json');
        }
      }, 5000);

    } catch (error) {
      console.error('❌ Error crítico creando acc-broadcast:', error.message);
      console.log('💡 Verifica que la librería esté correctamente instalada');
    }
  }

  setupBroadcastEvents() {
    if (!this.accBroadcast) return;

    // === EVENTOS OFICIALES SEGÚN DOCUMENTACIÓN ===
    
    // 1. REGISTRATION_RESULT - Resultado del registro
    this.accBroadcast.on("registration_result", (result) => {
      const timestamp = new Date().toLocaleTimeString();
      if (result.ConnectionSuccess) {
        console.log(`\n🎉 [${timestamp}] ¡CONECTADO A ACC!`);
        console.log(`✅ Connection ID: ${result.ConnectionId}`);
        console.log(`🔓 Read Only: ${result.isReadOnly ? 'Sí' : 'No'}`);
        console.log('📊 Protocolo oficial activo - Recibiendo telemetría completa');
        this.isConnected = true;
      } else {
        console.log(`\n❌ [${timestamp}] Error de conexión: ${result.errMsg}`);
        this.isConnected = false;
      }
    });

    // 2. REALTIME_UPDATE - Datos generales de sesión
    this.accBroadcast.on("realtime_update", (update) => {
      this.handleRealtimeUpdate(update);
    });

    // 3. REALTIME_CAR_UPDATE - Datos específicos de cada coche
    this.accBroadcast.on("realtime_car_update", (carUpdate) => {
      this.handleRealtimeCarUpdate(carUpdate);
    });

    // 4. ENTRY_LIST - Lista de coches (se envía como Map)
    this.accBroadcast.on("entry_list", (cars) => {
      console.log(`🚗 Lista de coches recibida: ${cars.size} coches`);
      this.handleEntryList(cars);
    });

    // 5. ENTRY_LIST_CAR - Información detallada de cada coche
    this.accBroadcast.on("entry_list_car", (carInfo) => {
      this.handleEntryListCar(carInfo);
    });

    // 6. TRACK_DATA - Información del circuito
    this.accBroadcast.on("track_data", (trackData) => {
      this.handleTrackData(trackData);
    });

    // 7. BROADCASTING_EVENT - Eventos especiales
    this.accBroadcast.on("broadcasting_event", (event) => {
      this.handleBroadcastingEvent(event);
    });

    // Eventos de error y desconexión
    this.accBroadcast.on("error", (error) => {
      console.log('\n❌ ERROR en acc-broadcast:', error);
      console.log('💡 Verifica que ACC esté abierto y en una sesión activa');
    });

    this.accBroadcast.on("disconnect", () => {
      console.log('\n🔌 Desconectado de ACC');
      console.log('⚠️ Reintentando conexión automáticamente...');
      this.isConnected = false;
      
      // Reintentar conexión después de 3 segundos
      setTimeout(() => {
        if (this.isRunning && !this.isConnected) {
          console.log('🔄 Reintentando conexión...');
          try {
            this.accBroadcast = new AccBroadcast("ACC Complete Monitor", "asd");
            this.setupBroadcastEvents();
          } catch (error) {
            console.log('❌ Error en reintento:', error.message);
          }
        }
      }, 3000);
    });
  }

  // === MANEJADORES DE DATOS OFICIALES ===

  handleRealtimeUpdate(update) {
    // Actualizar datos de sesión según la estructura oficial
    this.sessionData = {
      eventIndex: update.EventIndex || 0,
      sessionIndex: update.SessionIndex || 0,
      sessionType: update.SessionType || 0,
      phase: update.Phase || 0,
      sessionTime: update.sessionTime || 0,
      sessionEndTime: update.sessionEndTime || 0,
      focusedCarIndex: update.FocusedCarIndex || 0,
      activeCameraSet: update.ActiveCameraSet || '',
      activeCamera: update.ActiveCamera || '',
      currentHudPage: update.CurrentHudPage || '',
      isReplayPlaying: update.IsReplayPlaying || false,
      timeOfDay: update.TimeOfDay || 0,
      ambientTemp: update.AmbientTemp || 0,
      trackTemp: update.TrackTemp || 0,
      clouds: update.Clouds || 0,
      rainLevel: update.RainLevel || 0,
      wetness: update.Wetness || 0
    };

    // Actualizar mejor vuelta de sesión si existe
    if (update.BestSessionLap) {
      this.lapData.bestSessionLap = {
        laptimeMS: update.BestSessionLap.LaptimeMS,
        splits: update.BestSessionLap.Splits || [null, null, null],
        isValid: update.BestSessionLap.IsValidForBest || false,
        isInvalid: update.BestSessionLap.IsInvalid || false
      };
    }
  }

  handleRealtimeCarUpdate(carUpdate) {
    // Solo procesar si es nuestro coche (índice 0 en single player, o el enfocado)
    const isOurCar = carUpdate.CarIndex === 0 || 
                     carUpdate.CarIndex === this.sessionData.focusedCarIndex ||
                     this.sessionData.focusedCarIndex === 0; // Si no hay enfoque específico

    if (!isOurCar) return; // Ignorar otros coches por ahora

    // Actualizar datos en tiempo real según estructura oficial
    this.realtimeData = {
      speed: Math.round(carUpdate.Kmh || 0),
      gear: this.formatGear(carUpdate.Gear),
      position: carUpdate.Position || 0,
      cupPosition: carUpdate.CupPosition || 0,
      trackPosition: carUpdate.TrackPosition || 0,
      splinePosition: carUpdate.SplinePosition || 0,
      laps: carUpdate.Laps || 0,
      delta: carUpdate.Delta || 0,
      carLocation: carUpdate.CarLocation || 0,
      worldPosX: carUpdate.WorldPosX || 0,
      worldPosY: carUpdate.WorldPosY || 0,
      yaw: carUpdate.Yaw || 0,
      carIndex: carUpdate.CarIndex || 0,
      driverIndex: carUpdate.DriverIndex || 0,
      driverCount: carUpdate.DriverCount || 0
    };

    // Actualizar datos de vueltas
    if (carUpdate.BestSessionLap) {
      this.lapData.bestSessionLap = {
        laptimeMS: carUpdate.BestSessionLap.LaptimeMS,
        splits: carUpdate.BestSessionLap.Splits || [null, null, null],
        isValid: carUpdate.BestSessionLap.IsValidForBest || false,
        isInvalid: carUpdate.BestSessionLap.IsInvalid || false
      };
    }

    if (carUpdate.LastLap) {
      this.lapData.lastLap = {
        laptimeMS: carUpdate.LastLap.LaptimeMS,
        splits: carUpdate.LastLap.Splits || [null, null, null],
        isValid: carUpdate.LastLap.IsValidForBest || false,
        isInvalid: carUpdate.LastLap.IsInvalid || false
      };
    }

    if (carUpdate.CurrentLap) {
      this.lapData.currentLap = {
        laptimeMS: carUpdate.CurrentLap.LaptimeMS,
        splits: carUpdate.CurrentLap.Splits || [null, null, null],
        isValid: carUpdate.CurrentLap.IsValidForBest || false,
        isInvalid: carUpdate.CurrentLap.IsInvalid || false
      };
    }

    this.updateTelemetryDisplay();
  }

  handleEntryList(cars) {
    console.log(`🚗 Entry List actualizada: ${cars.size} coches en pista`);
    // Los detalles de cada coche llegarán por entry_list_car
  }

  handleEntryListCar(carInfo) {
    // Solo procesar nuestro coche
    const isOurCar = carInfo.CarIndex === 0 || 
                     carInfo.CarIndex === this.sessionData.focusedCarIndex ||
                     this.sessionData.focusedCarIndex === 0;

    if (!isOurCar) return;

    console.log('✅ Información del coche del jugador recibida');

    // Actualizar información del coche
    this.carInfo = {
      carModel: this.getCarModelName(carInfo.CarModelType),
      carModelId: carInfo.CarModelType,
      teamName: carInfo.TeamName || '',
      raceNumber: carInfo.RaceNumber || 0,
      cupCategory: this.getCupCategoryName(carInfo.CupCategory),
      nationality: this.getNationalityName(carInfo.Nationality)
    };

    // Información del piloto actual
    if (carInfo.CurrentDriver) {
      this.driverInfo = {
        firstName: carInfo.CurrentDriver.FirstName || '',
        lastName: carInfo.CurrentDriver.LastName || '',
        shortName: carInfo.CurrentDriver.ShortName || '',
        category: this.getDriverCategoryName(carInfo.CurrentDriver.Category),
        nationality: this.getNationalityName(carInfo.CurrentDriver.Nationality)
      };
    }

    console.log(`\n🏎️ INFORMACIÓN DEL COCHE ACTUALIZADA:`);
    console.log(`   Modelo: ${this.carInfo.carModel}`);
    console.log(`   Equipo: ${this.carInfo.teamName}`);
    console.log(`   Número: #${this.carInfo.raceNumber}`);
    console.log(`   Piloto: ${this.driverInfo.firstName} ${this.driverInfo.lastName}`);
    console.log(`   Categoría: ${this.carInfo.cupCategory}`);
  }

  handleTrackData(trackData) {
    this.trackData = {
      trackName: trackData.TrackName || '',
      trackId: trackData.TrackId || 0,
      trackMeters: trackData.TrackMeters || 0,
      cameraSets: trackData.CameraSets || {},
      hudPages: trackData.HUDPages || []
    };

    console.log(`🏁 Pista: ${this.trackData.trackName} (${this.trackData.trackMeters}m)`);
    console.log(`📷 Sets de cámaras: ${Object.keys(this.trackData.cameraSets).join(', ')}`);
  }

  handleBroadcastingEvent(event) {
    this.lastEvent = {
      type: event.Type,
      msg: event.Msg,
      timeMs: event.TimeMs,
      carId: event.CarId,
      carData: event.Car
    };

    const eventTypes = {
      0: 'None',
      1: 'Green Flag',
      2: 'Session Over',
      3: 'Penalty Communication',
      4: 'Accident',
      5: 'Lap Completed',
      6: 'Best Session Lap',
      7: 'Best Personal Lap'
    };

    const eventName = eventTypes[event.Type] || `Desconocido (${event.Type})`;
    console.log(`🎯 Evento: ${eventName} - ${event.Msg}`);
  }

  // === FUNCIONES DE FORMATO ===

  formatGear(gear) {
    if (gear === undefined || gear === null) return 'N';
    if (gear === -1) return 'R';
    if (gear === 0) return 'N';
    return gear.toString();
  }

  formatTime(milliseconds) {
    if (!milliseconds || milliseconds <= 0) return '--:--.---';
    
    const totalSeconds = milliseconds / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  updateTelemetryDisplay() {
    this.updateCount++;
    const timestamp = new Date().toLocaleTimeString();
    
    const now = Date.now();
    if (now - this.lastDisplayTime > 1000) { // Mostrar cada segundo
      console.log(`\n📊 [${timestamp}] TELEMETRÍA OFICIAL #${this.updateCount}`);
      console.log('═'.repeat(60));
      
      // === INFORMACIÓN DEL COCHE ===
      console.log('🚗 INFORMACIÓN DEL COCHE:');
      console.log(`   Modelo: ${this.carInfo.carModel}`);
      console.log(`   Equipo: ${this.carInfo.teamName}`);
      console.log(`   Número: #${this.carInfo.raceNumber}`);
      console.log(`   Piloto: ${this.driverInfo.firstName} ${this.driverInfo.lastName}`);
      console.log(`   Categoría: ${this.carInfo.cupCategory}`);
      
      // === DATOS EN TIEMPO REAL ===
      console.log('\n⚡ TELEMETRÍA EN TIEMPO REAL:');
      console.log(`   Velocidad: ${this.realtimeData.speed} km/h`);
      console.log(`   Marcha: ${this.realtimeData.gear}`);
      console.log(`   Posición: ${this.realtimeData.position}º`);
      console.log(`   Vueltas: ${this.realtimeData.laps}`);
      console.log(`   Ubicación: ${this.getLocationName(this.realtimeData.carLocation)}`);
      
      if (this.realtimeData.delta !== 0) {
        const deltaSign = this.realtimeData.delta > 0 ? '+' : '';
        console.log(`   Delta: ${deltaSign}${(this.realtimeData.delta / 1000).toFixed(3)}s`);
      }
      
      // === DATOS DE VUELTAS ===
      console.log('\n🏁 TIEMPOS DE VUELTA:');
      if (this.lapData.bestSessionLap.laptimeMS) {
        console.log(`   Mejor sesión: ${this.formatTime(this.lapData.bestSessionLap.laptimeMS)}`);
      }
      if (this.lapData.lastLap.laptimeMS) {
        console.log(`   Última vuelta: ${this.formatTime(this.lapData.lastLap.laptimeMS)}`);
      }
      if (this.lapData.currentLap.laptimeMS) {
        console.log(`   Vuelta actual: ${this.formatTime(this.lapData.currentLap.laptimeMS)}`);
      }

      // === DATOS DE SESIÓN ===
      console.log('\n🏆 INFORMACIÓN DE SESIÓN:');
      console.log(`   Tipo: ${this.getSessionTypeName(this.sessionData.sessionType)}`);
      console.log(`   Fase: ${this.getSessionPhaseName(this.sessionData.phase)}`);
      console.log(`   Temperatura pista: ${this.sessionData.trackTemp}°C`);
      console.log(`   Temperatura ambiente: ${this.sessionData.ambientTemp}°C`);
      
      if (this.sessionData.rainLevel > 0) {
        console.log(`   Lluvia: ${Math.round(this.sessionData.rainLevel * 100)}%`);
      }
      if (this.sessionData.wetness > 0) {
        console.log(`   Humedad pista: ${Math.round(this.sessionData.wetness * 100)}%`);
      }
      
      console.log('─'.repeat(60));
      this.lastDisplayTime = now;
    }

    this.emitTelemetry();
  }

  emitTelemetry() {
    io.emit('telemetry_update', {
      // Información del coche
      carInfo: this.carInfo,
      driverInfo: this.driverInfo,
      
      // Datos en tiempo real
      realtimeData: this.realtimeData,
      
      // Datos de vueltas
      lapData: this.lapData,
      
      // Datos de sesión
      sessionData: this.sessionData,
      
      // Datos del circuito
      trackData: this.trackData,
      
      // Último evento
      lastEvent: this.lastEvent,
      
      // Metadatos
      timestamp: new Date(),
      isRunning: this.isRunning,
      isConnected: this.isConnected,
      protocol: 'official_corrected'
    });
  }

  // === FUNCIONES DE MAPEO ===

  getCarModelName(carModelId) {
    const carModels = {
      0: 'Porsche 991 GT3 R',
      1: 'Mercedes-AMG GT3',
      2: 'Ferrari 488 GT3',
      3: 'Audi R8 LMS',
      4: 'Lamborghini Huracán GT3',
      5: 'McLaren 650S GT3',
      6: 'Nissan GT-R Nismo GT3 2018',
      7: 'BMW M6 GT3',
      8: 'Bentley Continental GT3 2018',
      9: 'Porsche 991II GT3 Cup',
      10: 'Nissan GT-R Nismo GT3 2015',
      11: 'Bentley Continental GT3 2016',
      12: 'Aston Martin Vantage V12 GT3',
      13: 'Lamborghini Gallardo R-EX',
      14: 'Jaguar G3',
      15: 'Lexus RC F GT3',
      16: 'Lamborghini Huracán GT3 Evo',
      17: 'Honda NSX GT3',
      18: 'Lamborghini Huracán Super Trofeo',
      19: 'Audi R8 LMS Evo',
      20: 'AMR V8 Vantage',
      21: 'Honda NSX GT3 Evo',
      22: 'McLaren 720S GT3',
      23: 'Porsche 911II GT3 R',
      24: 'Ferrari 488 GT3 Evo',
      25: 'Mercedes-AMG GT3 2020',
      26: 'Ferrari 488 Challenge Evo',
      27: 'BMW M2 CS Racing',
      28: 'Porsche 911 GT3 Cup (Type 992)',
      29: 'Lamborghini Huracán Super Trofeo EVO2',
      30: 'BMW M4 GT3',
      31: 'Audi R8 LMS GT3 evo II'
    };
    
    return carModels[carModelId] || `Coche Desconocido (ID: ${carModelId})`;
  }

  getCupCategoryName(cupCategory) {
    const categories = {
      0: 'Overall/Pro',
      1: 'ProAm',
      2: 'Am',
      3: 'Silver',
      4: 'National'
    };
    
    return categories[cupCategory] || `Desconocido (${cupCategory})`;
  }

  getDriverCategoryName(category) {
    const categories = {
      0: 'Bronze',
      1: 'Silver', 
      2: 'Gold',
      3: 'Platinum',
      255: 'Error'
    };
    
    return categories[category] || `Desconocido (${category})`;
  }

  getSessionTypeName(sessionType) {
    const types = {
      0: 'Practice',
      4: 'Qualifying',
      9: 'Superpole',
      10: 'Race',
      11: 'Hotlap',
      12: 'Hotstint',
      13: 'Hotlap Superpole',
      14: 'Replay'
    };
    
    return types[sessionType] || `Desconocido (${sessionType})`;
  }

  getSessionPhaseName(phase) {
    const phases = {
      0: 'None',
      1: 'Starting',
      2: 'Pre Formation',
      3: 'Formation Lap',
      4: 'Pre Session',
      5: 'Session',
      6: 'Session Over',
      7: 'Post Session',
      8: 'Result UI'
    };
    
    return phases[phase] || `Desconocido (${phase})`;
  }

  getLocationName(location) {
    const locations = {
      0: 'None',
      1: 'Track',
      2: 'Pitlane',
      3: 'Pit Entry',
      4: 'Pit Exit'
    };
    
    return locations[location] || `Desconocido (${location})`;
  }

  getNationalityName(nationality) {
    const nationalities = {
      0: 'Any', 1: 'Italy', 2: 'Germany', 3: 'France', 4: 'Spain',
      5: 'Great Britain', 6: 'Hungary', 7: 'Belgium', 8: 'Switzerland',
      9: 'Austria', 10: 'Russia', 11: 'Thailand', 12: 'Netherlands',
      13: 'Poland', 14: 'Argentina', 15: 'Monaco', 16: 'Ireland',
      17: 'Brazil', 18: 'South Africa', 19: 'Puerto Rico', 20: 'Slovakia',
      21: 'Oman', 22: 'Greece', 23: 'Saudi Arabia', 24: 'Norway',
      25: 'Turkey', 26: 'South Korea', 27: 'Lebanon', 28: 'Armenia',
      29: 'Mexico', 30: 'Sweden', 31: 'Finland', 32: 'Denmark',
      33: 'Croatia', 34: 'Canada', 35: 'China', 36: 'Portugal',
      37: 'Singapore', 38: 'Indonesia', 39: 'USA', 40: 'New Zealand',
      41: 'Australia', 42: 'San Marino', 43: 'UAE', 44: 'Luxembourg',
      45: 'Kuwait', 46: 'Hong Kong', 47: 'Colombia', 48: 'Japan',
      49: 'Andorra', 50: 'Azerbaijan', 51: 'Bulgaria', 52: 'Cuba',
      53: 'Czech Republic', 54: 'Estonia', 55: 'Georgia', 56: 'India',
      57: 'Israel', 58: 'Jamaica', 59: 'Latvia', 60: 'Lithuania',
      61: 'Macau', 62: 'Malaysia', 63: 'Nepal', 64: 'New Caledonia',
      65: 'Nigeria', 66: 'Northern Ireland', 67: 'Papua New Guinea', 68: 'Philippines',
      69: 'Qatar', 70: 'Romania', 71: 'Scotland', 72: 'Serbia',
      73: 'Slovenia', 74: 'Taiwan', 75: 'Ukraine', 76: 'Venezuela',
      77: 'Wales', 78: 'Iran', 79: 'Bahrain', 80: 'Zimbabwe',
      81: 'Chinese Taipei', 82: 'Chile', 83: 'Uruguay', 84: 'Madagascar'
    };
    
    return nationalities[nationality] || `Desconocido (${nationality})`;
  }

  getCurrentData() {
    return {
      carInfo: this.carInfo,
      driverInfo: this.driverInfo,
      realtimeData: this.realtimeData,
      lapData: this.lapData,
      sessionData: this.sessionData,
      trackData: this.trackData,
      lastEvent: this.lastEvent,
      timestamp: new Date(),
      isRunning: this.isRunning,
      isConnected: this.isConnected,
      protocol: 'official_corrected'
    };
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.isConnected = false;

    if (this.accBroadcast) {
      this.accBroadcast.disconnect();
      this.accBroadcast = null;
    }

    console.log('🛑 Monitor detenido');
  }
}

// Variables globales
let accMonitor = null;
let isListening = false;

function initializeMonitor() {
  if (!libraryAvailable) {
    console.log('❌ No se puede inicializar - Librería acc-broadcast requerida');
    return null;
  }
  accMonitor = new ACCOfficialMonitor();
  return accMonitor;
}

// RUTAS DE LA API
app.post('/api/start', (req, res) => {
  try {
    if (!libraryAvailable) {
      return res.status(500).json({ 
        error: 'Librería acc-broadcast no disponible. Instalar con: npm install acc-broadcast' 
      });
    }
    
    if (isListening) {
      return res.json({ message: 'Ya está conectado a ACC' });
    }

    if (!accMonitor) {
      if (!initializeMonitor()) {
        return res.status(500).json({ error: 'No se pudo inicializar el monitor' });
      }
    }
    
    if (accMonitor.start()) {
      isListening = true;
      res.json({ message: 'Monitor ACC iniciado con protocolo oficial corregido' });
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

    if (accMonitor) {
      accMonitor.stop();
    }
    isListening = false;
    res.json({ message: 'Monitor detenido' });
  } catch (error) {
    console.error('Error deteniendo:', error);
    res.status(500).json({ error: 'Error deteniendo monitor' });
  }
});

app.get('/api/telemetry', (req, res) => {
  const data = accMonitor ? accMonitor.getCurrentData() : {
    carInfo: {
      carModel: 'Desconocido',
      carModelId: null,
      teamName: '',
      raceNumber: 0,
      cupCategory: '',
      nationality: ''
    },
    driverInfo: { 
      firstName: '', 
      lastName: '', 
      shortName: '', 
      category: '', 
      nationality: '' 
    },
    realtimeData: { 
      speed: 0, 
      gear: 'N', 
      position: 0, 
      cupPosition: 0,
      trackPosition: 0,
      splinePosition: 0,
      laps: 0, 
      delta: 0, 
      carLocation: 0,
      worldPosX: 0,
      worldPosY: 0,
      yaw: 0,
      carIndex: 0,
      driverIndex: 0,
      driverCount: 0
    },
    lapData: {
      bestSessionLap: { laptimeMS: null, splits: [null, null, null], isValid: false, isInvalid: false },
      lastLap: { laptimeMS: null, splits: [null, null, null], isValid: false, isInvalid: false },
      currentLap: { laptimeMS: null, splits: [null, null, null], isValid: false, isInvalid: false }
    },
    sessionData: {
      eventIndex: 0,
      sessionIndex: 0,
      sessionType: 0,
      phase: 0,
      sessionTime: 0,
      sessionEndTime: 0,
      focusedCarIndex: 0,
      activeCameraSet: '',
      activeCamera: '',
      currentHudPage: '',
      isReplayPlaying: false,
      timeOfDay: 0,
      ambientTemp: 0,
      trackTemp: 0,
      clouds: 0,
      rainLevel: 0,
      wetness: 0
    },
    trackData: {
      trackName: '',
      trackId: 0,
      trackMeters: 0,
      cameraSets: {},
      hudPages: []
    },
    lastEvent: null,
    timestamp: new Date(),
    isRunning: false,
    isConnected: false,
    protocol: 'none'
  };
  
  res.json(data);
});

app.get('/api/status', (req, res) => {
  res.json({
    libraryAvailable: libraryAvailable,
    isRunning: isListening,
    isConnected: accMonitor ? accMonitor.isConnected : false,
    protocol: libraryAvailable ? 'official_corrected' : 'unavailable'
  });
});

// Servir archivos estáticos desde la carpeta public
app.use(express.static('public'));

// Inicialización y Auto-start
console.log('🚀 Iniciando Monitor ACC - Protocolo Oficial Corregido...');

if (libraryAvailable) {
  console.log('✅ Librería acc-broadcast disponible');
  
  // Inicializar el monitor
  const monitor = initializeMonitor();
  
  if (monitor) {
    // AUTO-START INMEDIATO
    console.log('🚀 Iniciando conexión automática...');
    
    if (monitor.start()) {
      isListening = true;
      console.log('✅ Monitor iniciado automáticamente');
      
      // Mostrar instrucciones después de iniciar
      setTimeout(() => {
        console.log('');
        console.log('📋 PROTOCOLO OFICIAL CORREGIDO:');
        console.log('═'.repeat(60));
        console.log('✅ Eventos oficiales configurados correctamente');
        console.log('✅ Servidor corriendo en puerto 5000');
        console.log('✅ Monitor ACC iniciado automáticamente');
        console.log('🔍 Esperando conexión con ACC...');
        console.log('');
        console.log('📖 CONFIGURACIÓN REQUERIDA:');
        console.log('   1. Archivo: Documents\\Assetto Corsa Competizione\\Config\\broadcasting.json');
        console.log('   2. Contenido mínimo:');
        console.log('      {');
        console.log('        "updListenerPort": 9000,');
        console.log('        "connectionPassword": "asd",');
        console.log('        "commandPassword": ""');
        console.log('      }');
        console.log('');
        console.log('🎮 PASOS PARA USAR:');
        console.log('   1. Abre ACC');
        console.log('   2. Ve a una sesión activa (Practice/Qualifying/Race)');
        console.log('   3. ¡La conexión debería ser automática!');
        console.log('   4. Abre http://localhost:5000 para ver el dashboard');
        console.log('');
        console.log('🔧 EVENTOS OFICIALES CONFIGURADOS:');
        console.log('   • registration_result - Estado de conexión');
        console.log('   • realtime_update - Datos de sesión');
        console.log('   • realtime_car_update - Telemetría del coche');
        console.log('   • entry_list - Lista de coches');
        console.log('   • entry_list_car - Detalles de cada coche');
        console.log('   • track_data - Información del circuito');
        console.log('   • broadcasting_event - Eventos especiales');
        console.log('');
      }, 1000);
    } else {
      console.log('❌ Error iniciando el monitor automáticamente');
    }
  }
} else {
  console.log('');
  console.log('❌ LIBRERÍA NO DISPONIBLE');
  console.log('═'.repeat(50));
  console.log('Esta aplicación requiere la librería acc-broadcast');
  console.log('');
  console.log('📦 INSTALACIÓN:');
  console.log('   npm install acc-broadcast');
  console.log('');
  console.log('🔄 Después de instalar, reinicia la aplicación');
  console.log('');
}

// Manejo de cierre limpio
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  if (accMonitor && isListening) {
    accMonitor.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminando servidor...');
  if (accMonitor && isListening) {
    accMonitor.stop();
  }
  process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  if (accMonitor && isListening) {
    accMonitor.stop();
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log('');
  console.log('🚀 SERVIDOR ACC MONITOR ACTIVO');
  console.log('═'.repeat(50));
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🌐 Dashboard web: http://localhost:${PORT}`);
  console.log(`🔧 API telemetría: http://localhost:${PORT}/api/telemetry`);
  console.log(`📊 API estado: http://localhost:${PORT}/api/status`);
  console.log(`🎮 Protocolo: ${libraryAvailable ? 'Oficial Corregido' : 'NO DISPONIBLE'}`);
  console.log('');
  console.log('💡 Presiona Ctrl+C para salir');
  console.log('═'.repeat(50));
});