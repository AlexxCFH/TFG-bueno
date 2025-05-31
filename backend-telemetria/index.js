require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// NUEVO: Importar gestor híbrido
const { HybridProtocolManager } = require('./hybrid-protocol-manager');

// Importar monitores
const { ACCSharedMemoryMonitor } = require('./acc-shared-memory-monitor');

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

// CLASE BROADCASTING MODIFICADA PARA GESTOR HÍBRIDO
class ACCBroadcastingMonitor {
    constructor(hybridManager) {
        this.hybridManager = hybridManager;
        this.accBroadcast = null;
        this.isRunning = false;
        this.isConnected = false;
        this.updateCount = 0;
        this.playerCarIndex = null;
        this.playerCarIdentified = false;

        // Registrarse en el gestor híbrido
        this.hybridManager.registerProtocol('broadcasting', this);

        // Datos internos (sin emitir directamente)
        this.carInfo = {
            carModel: 'Desconocido',
            carModelId: null,
            teamName: '',
            raceNumber: 0,
            cupCategory: '',
            nationality: ''
        };

        this.driverInfo = {
            firstName: '',
            lastName: '',
            shortName: '',
            category: '',
            nationality: ''
        };

        this.realtimeData = {
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
        };

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

        this.sessionData = {
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
        };

        this.trackData = {
            trackName: '',
            trackId: 0,
            trackMeters: 0,
            cameraSets: {},
            hudPages: []
        };

        this.lastEvent = null;
        this.allCars = new Map();
    }

    start() {
        if (!libraryAvailable) {
            console.log('❌ No se puede iniciar Broadcasting - Librería acc-broadcast no disponible');
            return false;
        }

        if (this.isRunning) {
            console.log('⚠️ Broadcasting ya está conectado');
            return true;
        }

        console.log('📡 INICIANDO MONITOR BROADCASTING (Gestor Híbrido)');
        this.startOfficialMonitor();
        this.isRunning = true;
        return true;
    }

    startOfficialMonitor() {
        try {
            this.accBroadcast = new AccBroadcast("ACC Hybrid Monitor", "asd");
            this.setupBroadcastEvents();
            console.log('📡 Broadcasting iniciado - Esperando conexión...');
        } catch (error) {
            console.error('❌ Error iniciando Broadcasting:', error.message);
        }
    }

    setupBroadcastEvents() {
        if (!this.accBroadcast) return;

        this.accBroadcast.on("registration_result", (result) => {
            if (result.ConnectionSuccess) {
                console.log('✅ Broadcasting CONECTADO');
                this.isConnected = true;
                this.hybridManager.updateConnectionStatus('broadcasting', true);
            } else {
                console.log('❌ Error Broadcasting:', result.errMsg);
                this.isConnected = false;
                this.hybridManager.updateConnectionStatus('broadcasting', false);
            }
        });

        this.accBroadcast.on("realtime_update", (update) => {
            this.handleRealtimeUpdate(update);
            this.sendDataToHybridManager();
        });

        this.accBroadcast.on("realtime_car_update", (carUpdate) => {
            this.handleRealtimeCarUpdate(carUpdate);
            this.sendDataToHybridManager();
        });

        this.accBroadcast.on("entry_list", (cars) => {
            this.handleEntryList(cars);
            this.sendDataToHybridManager();
        });

        this.accBroadcast.on("entry_list_car", (carInfo) => {
            this.handleEntryListCar(carInfo);
            this.sendDataToHybridManager();
        });

        this.accBroadcast.on("track_data", (trackData) => {
            this.handleTrackData(trackData);
            this.sendDataToHybridManager();
        });

        this.accBroadcast.on("broadcasting_event", (event) => {
            this.handleBroadcastingEvent(event);
            this.sendDataToHybridManager();
        });

        this.accBroadcast.on("disconnect", () => {
            console.log('🔌 Broadcasting desconectado');
            this.isConnected = false;
            this.hybridManager.updateConnectionStatus('broadcasting', false);
        });
    }

    // MÉTODO CLAVE: Enviar datos al gestor híbrido en lugar de emitir directamente
    sendDataToHybridManager() {
        const data = {
            carInfo: this.carInfo,
            driverInfo: this.driverInfo,
            realtimeData: this.realtimeData,
            lapData: this.lapData,
            sessionData: this.sessionData,
            trackData: this.trackData,
            lastEvent: this.lastEvent,
            playerCarIndex: this.playerCarIndex,
            playerCarIdentified: this.playerCarIdentified,
            allCarsCount: this.allCars.size,
            timestamp: new Date(),
            isRunning: this.isRunning,
            isConnected: this.isConnected,
            protocol: 'broadcasting'
        };

        this.hybridManager.processData('broadcasting', data);
    }

    // Resto de métodos sin cambios (solo procesan datos internamente)
    handleRealtimeUpdate(update) {
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

        if (!this.playerCarIdentified && this.sessionData.focusedCarIndex !== undefined) {
            this.playerCarIndex = this.sessionData.focusedCarIndex;
            this.playerCarIdentified = true;
        }

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
        this.allCars.set(carUpdate.CarIndex, {
            carIndex: carUpdate.CarIndex,
            position: carUpdate.Position,
            kmh: carUpdate.Kmh,
            gear: carUpdate.Gear,
            lastUpdate: Date.now()
        });

        if (!this.isPlayerCar(carUpdate.CarIndex)) {
            return;
        }

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
    }

    handleEntryList(cars) {
        if (!this.playerCarIdentified) {
            this.identifyPlayerCar(cars);
        }
    }

    handleEntryListCar(carInfo) {
        if (!this.isPlayerCar(carInfo.CarIndex)) {
            return;
        }

        this.carInfo = {
            carModel: this.getCarModelName(carInfo.CarModelType),
            carModelId: carInfo.CarModelType,
            teamName: carInfo.TeamName || '',
            raceNumber: carInfo.RaceNumber || 0,
            cupCategory: this.getCupCategoryName(carInfo.CupCategory),
            nationality: this.getNationalityName(carInfo.Nationality)
        };

        if (carInfo.CurrentDriver) {
            this.driverInfo = {
                firstName: carInfo.CurrentDriver.FirstName || '',
                lastName: carInfo.CurrentDriver.LastName || '',
                shortName: carInfo.CurrentDriver.ShortName || '',
                category: this.getDriverCategoryName(carInfo.CurrentDriver.Category),
                nationality: this.getNationalityName(carInfo.CurrentDriver.Nationality)
            };
        }
    }

    handleTrackData(trackData) {
        this.trackData = {
            trackName: trackData.TrackName || '',
            trackId: trackData.TrackId || 0,
            trackMeters: trackData.TrackMeters || 0,
            cameraSets: trackData.CameraSets || {},
            hudPages: trackData.HUDPages || []
        };
    }

    handleBroadcastingEvent(event) {
        this.lastEvent = {
            type: event.Type,
            msg: event.Msg,
            timeMs: event.TimeMs,
            carId: event.CarId,
            carData: event.Car
        };
    }

    // === FUNCIONES AUXILIARES ===

    identifyPlayerCar(cars) {
        if (this.sessionData.focusedCarIndex !== undefined && this.sessionData.focusedCarIndex >= 0) {
            this.playerCarIndex = this.sessionData.focusedCarIndex;
            this.playerCarIdentified = true;
            return true;
        }

        if (cars.size === 1) {
            const firstCarIndex = cars.keys().next().value;
            this.playerCarIndex = firstCarIndex;
            this.playerCarIdentified = true;
            return true;
        }

        if (cars.size > 0) {
            const firstCarIndex = cars.keys().next().value;
            this.playerCarIndex = firstCarIndex;
            this.playerCarIdentified = true;
            return true;
        }

        return false;
    }

    isPlayerCar(carIndex) {
        if (!this.playerCarIdentified) {
            if (this.allCars.size === 1) {
                this.playerCarIndex = carIndex;
                this.playerCarIdentified = true;
                return true;
            }

            if (this.sessionData.focusedCarIndex !== undefined && this.sessionData.focusedCarIndex >= 0) {
                this.playerCarIndex = this.sessionData.focusedCarIndex;
                this.playerCarIdentified = true;
            }
        }

        return this.playerCarIdentified && carIndex === this.playerCarIndex;
    }

    formatGear(gear) {
        if (gear === undefined || gear === null) return 'N';
        if (gear === -1) return 'R';
        if (gear === 0) return 'N';
        return gear.toString();
    }

    // === FUNCIONES DE MAPEO (versiones simplificadas) ===

    getCarModelName(carModelId) {
        const carModels = {
            0: 'Porsche 991 GT3 R', 1: 'Mercedes-AMG GT3', 2: 'Ferrari 488 GT3',
            3: 'Audi R8 LMS', 4: 'Lamborghini Huracán GT3', 5: 'McLaren 650S GT3',
            6: 'Nissan GT-R Nismo GT3 2018', 7: 'BMW M6 GT3', 8: 'Bentley Continental GT3 2018',
            9: 'Porsche 991II GT3 Cup', 10: 'Nissan GT-R Nismo GT3 2015', 11: 'Bentley Continental GT3 2016',
            12: 'Aston Martin Vantage V12 GT3', 13: 'Lamborghini Gallardo R-EX', 14: 'Jaguar G3',
            15: 'Lexus RC F GT3', 16: 'Lamborghini Huracán GT3 Evo', 17: 'Honda NSX GT3',
            18: 'Lamborghini Huracán Super Trofeo', 19: 'Audi R8 LMS Evo', 20: 'AMR V8 Vantage',
            21: 'Honda NSX GT3 Evo', 22: 'McLaren 720S GT3', 23: 'Porsche 911II GT3 R',
            24: 'Ferrari 488 GT3 Evo', 25: 'Mercedes-AMG GT3 2020', 26: 'Ferrari 488 Challenge Evo',
            27: 'BMW M2 CS Racing', 28: 'Porsche 911 GT3 Cup (Type 992)', 29: 'Lamborghini Huracán Super Trofeo EVO2',
            30: 'BMW M4 GT3', 31: 'Audi R8 LMS GT3 evo II'
        };
        return carModels[carModelId] || `Coche Desconocido (ID: ${carModelId})`;
    }

    getCupCategoryName(cupCategory) {
        const categories = { 0: 'Overall/Pro', 1: 'ProAm', 2: 'Am', 3: 'Silver', 4: 'National' };
        return categories[cupCategory] || `Desconocido (${cupCategory})`;
    }

    getDriverCategoryName(category) {
        const categories = { 0: 'Bronze', 1: 'Silver', 2: 'Gold', 3: 'Platinum', 255: 'Error' };
        return categories[category] || `Desconocido (${category})`;
    }

    getNationalityName(nationality) {
        // Versión simplificada
        const nationalities = {
            1: 'Italy', 2: 'Germany', 3: 'France', 4: 'Spain', 5: 'Great Britain',
            39: 'USA', 41: 'Australia', 17: 'Brazil', 35: 'China', 48: 'Japan'
        };
        return nationalities[nationality] || `País ${nationality}`;
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
            playerCarIndex: this.playerCarIndex,
            playerCarIdentified: this.playerCarIdentified,
            allCarsCount: this.allCars.size,
            timestamp: new Date(),
            isRunning: this.isRunning,
            isConnected: this.isConnected,
            protocol: 'broadcasting'
        };
    }

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        this.isConnected = false;
        this.hybridManager.updateConnectionStatus('broadcasting', false);

        if (this.accBroadcast) {
            this.accBroadcast.disconnect();
            this.accBroadcast = null;
        }
    }
}

// CLASE SHARED MEMORY MODIFICADA PARA GESTOR HÍBRIDO
class ACCSharedMemoryMonitorHybrid {
    constructor(hybridManager) {
        this.hybridManager = hybridManager;
        this.wrapper = null;
        this.isRunning = false;
        this.isConnected = false;
        this.updateCount = 0;

        // Registrarse en el gestor híbrido
        this.hybridManager.registerProtocol('sharedMemory', this);

        this.sharedMemoryData = {
            physics: {
                gas: 0, brake: 0, fuel: 0, gear: 0, rpm: 0, speedKmh: 0,
                accG: [0, 0, 0], tyreCoreTemperature: [0, 0, 0, 0],
                brakeTemp: [0, 0, 0, 0], wheelsPressure: [0, 0, 0, 0],
                engineTemp: 0, airTemp: 0, roadTemp: 0, steerAngle: 0,
                clutch: 0, turboBoost: 0, rideHeight: [0, 0],
                suspensionTravel: [0, 0, 0, 0], brakeBias: 0.5,
                abs: 0, tc: 0, autoShifterOn: 0, pitLimiterOn: 0,
                absInAction: 0, tcinAction: 0,
                ersIsCharging: 0, ersRecoveryLevel: 0, ersPowerLevel: 0,
                kersCurrentKJ: 0, kersMaxKJ: 0, kersInput: 0, drs: 0
            },
            graphics: {
                status: 0, session: 0, position: 0, completedLaps: 0,
                currentTime: '', lastTime: '', bestTime: '',
                deltaLapTime: 0, isInPit: 0, flag: 0, penalty: 0,
                tyreCompound: '', rainIntensity: 0, trackGripStatus: 1.0
            },
            static: {
                playerName: '', playerSurname: '', carModel: '',
                track: '', maxRpm: 0, maxFuel: 0, maxPower: 0,
                maxTurboBoost: 1.0, hasERS: 0, hasKERS: 0, hasDRS: 0
            }
        };
    }

    async start() {
        if (this.isRunning) {
            console.log('⚠️ Shared Memory ya está ejecutándose');
            return true;
        }

        console.log('🧠 INICIANDO MONITOR SHARED MEMORY (Gestor Híbrido)');

        try {
            const ACCNodeWrapper = require('acc-node-wrapper');
            this.wrapper = new ACCNodeWrapper();
            this.setupSharedMemoryEvents();
            this.wrapper.initSharedMemory(50, 100, 1000, false);

            this.isRunning = true;
            this.isConnected = true;
            this.hybridManager.updateConnectionStatus('sharedMemory', true);

            console.log('✅ Shared Memory iniciado');
            return true;

        } catch (error) {
            console.error('❌ Error iniciando Shared Memory:', error.message);
            this.isRunning = false;
            this.isConnected = false;
            this.hybridManager.updateConnectionStatus('sharedMemory', false);
            return false;
        }
    }

    setupSharedMemoryEvents() {
        if (!this.wrapper) return;

        this.wrapper.on('M_PHYSICS_RESULT', (data) => {
            this.handlePhysicsEvent(data);
            this.sendDataToHybridManager();
        });

        this.wrapper.on('M_GRAPHICS_RESULT', (data) => {
            this.handleGraphicsEvent(data);
            this.sendDataToHybridManager();
        });

        this.wrapper.on('M_STATIC_RESULT', (data) => {
            this.handleStaticEvent(data);
            this.sendDataToHybridManager();
        });
    }

    // MÉTODO CLAVE: Enviar datos al gestor híbrido
    sendDataToHybridManager() {
        const data = {
            carInfo: {
                carModel: this.sharedMemoryData.static.carModel || 'Conectando...',
                teamName: `${this.sharedMemoryData.static.playerName} ${this.sharedMemoryData.static.playerSurname}`.trim() || 'Jugador ACC',
                raceNumber: 1,
                cupCategory: 'Datos Reales ACC'
            },
            driverInfo: {
                firstName: this.sharedMemoryData.static.playerName || 'Piloto',
                lastName: this.sharedMemoryData.static.playerSurname || 'ACC'
            },
            realtimeData: {
                speed: this.sharedMemoryData.physics.speedKmh,
                gear: this.sharedMemoryData.physics.gear,
                position: this.sharedMemoryData.graphics.position,
                laps: this.sharedMemoryData.graphics.completedLaps,
                delta: this.sharedMemoryData.graphics.deltaLapTime * 1000,
                carLocation: this.sharedMemoryData.graphics.isInPit ? 2 : 1,
                velocity: [0, 0, this.sharedMemoryData.physics.speedKmh / 3.6]
            },
            lapData: {
                bestSessionLap: { laptimeMS: this.parseTimeString(this.sharedMemoryData.graphics.bestTime) },
                lastLap: { laptimeMS: this.parseTimeString(this.sharedMemoryData.graphics.lastTime) },
                currentLap: { laptimeMS: this.parseTimeString(this.sharedMemoryData.graphics.currentTime) }
            },
            sessionData: {
                sessionType: this.sharedMemoryData.graphics.session,
                phase: this.sharedMemoryData.graphics.status,
                ambientTemp: this.sharedMemoryData.physics.airTemp,
                trackTemp: this.sharedMemoryData.physics.roadTemp,
                rainLevel: this.sharedMemoryData.graphics.rainIntensity,
                wetness: Math.max(0, 1 - this.sharedMemoryData.graphics.trackGripStatus)
            },
            trackData: {
                trackName: this.sharedMemoryData.static.track || 'Cargando...',
                trackMeters: 7004
            },
            extendedData: {
                physics: this.sharedMemoryData.physics,
                graphics: this.sharedMemoryData.graphics,
                static: this.sharedMemoryData.static
            },
            timestamp: new Date(),
            isRunning: this.isRunning,
            isConnected: this.isConnected,
            protocol: 'shared_memory'
        };

        this.hybridManager.processData('sharedMemory', data);
    }

    handlePhysicsEvent(data) {
        this.sharedMemoryData.physics = {
            gas: data.gas || 0,
            brake: data.brake || 0,
            fuel: data.fuel || 0,
            gear: this.formatGear(data.gear),
            rpm: Math.round(data.rpms || 0),
            speedKmh: Math.round(data.speedKmh || 0),
            accG: data.accG || [0, 0, 0],
            tyreCoreTemperature: data.tyreCoreTemperature || [0, 0, 0, 0],
            brakeTemp: data.brakeTemp || [0, 0, 0, 0],
            wheelsPressure: data.wheelsPressure || [0, 0, 0, 0],
            engineTemp: data.engineTemp || 0,
            airTemp: data.airTemp || 0,
            roadTemp: data.roadTemp || 0,
            steerAngle: data.steerAngle || 0,
            clutch: data.clutch || 0,
            turboBoost: data.turboBoost || 0,
            rideHeight: data.rideHeight || [0, 0],
            suspensionTravel: data.suspensionTravel || [0, 0, 0, 0],
            brakeBias: data.brakeBias || 0.5,
            abs: data.abs || 0,
            tc: data.tc || 0,
            autoShifterOn: data.autoShifterOn || 0,
            pitLimiterOn: data.pitLimiterOn || 0,
            absInAction: data.absInAction || 0,
            tcinAction: data.tcinAction || 0,
            ersIsCharging: data.ersIsCharging || 0,
            ersRecoveryLevel: data.ersRecoveryLevel || 0,
            ersPowerLevel: data.ersPowerLevel || 0,
            kersCurrentKJ: data.kersCurrentKJ || 0,
            kersMaxKJ: data.kersMaxKJ || 0,
            kersInput: data.kersInput || 0,
            drs: data.drs || 0
        };
        this.updateCount++;
    }

    handleGraphicsEvent(data) {
        this.sharedMemoryData.graphics = {
            status: data.status || 0,
            session: data.session || 0,
            position: data.position || 0,
            completedLaps: data.completedLaps || 0,
            currentTime: this.safeString(data.currentTime),
            lastTime: this.safeString(data.lastTime),
            bestTime: this.safeString(data.bestTime),
            deltaLapTime: data.deltaLapTime || 0,
            isInPit: data.isInPit || 0,
            flag: data.flag || 0,
            penalty: data.penalty || 0,
            tyreCompound: this.safeString(data.tyreCompound),
            rainIntensity: data.rainIntensity || 0,
            trackGripStatus: data.trackGripStatus || 1.0
        };
    }

    handleStaticEvent(data) {
        this.sharedMemoryData.static = {
            playerName: this.safeString(data.playerName),
            playerSurname: this.safeString(data.playerSurname),
            carModel: this.safeString(data.carModel),
            track: this.safeString(data.track),
            maxRpm: data.maxRpm || 0,
            maxFuel: data.maxFuel || 0,
            maxPower: data.maxPower || 0,
            maxTurboBoost: data.maxTurboBoost || 1.0,
            hasERS: data.hasERS || 0,
            hasKERS: data.hasKERS || 0,
            hasDRS: data.hasDRS || 0
        };
    }

    safeString(value) {
        if (value === null || value === undefined) return '';
        let result = '';
        if (Array.isArray(value)) {
            result = value.join('');
        } else if (value instanceof Buffer) {
            result = value.toString();
        } else if (typeof value === 'string') {
            result = value;
        } else {
            result = String(value);
        }
        return result.replace(/\0/g, '').replace(/_/g, ' ').trim();
    }

    formatGear(gear) {
        if (gear === undefined || gear === null) return 'N';
        if (gear === -1) return 'R';
        if (gear === 0) return 'N';
        return gear.toString();
    }

    parseTimeString(timeString) {
        try {
            if (!timeString || timeString.length === 0 || timeString === '--:--.---') {
                return null;
            }
            const cleanTime = this.safeString(timeString);
            if (!cleanTime || cleanTime === '--:--.---') return null;
            const parts = cleanTime.split(':');
            if (parts.length !== 2) return null;
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseFloat(parts[1]) || 0;
            return (minutes * 60 + seconds) * 1000;
        } catch (error) {
            return null;
        }
    }

    getCurrentData() {
        return this.sendDataToHybridManager();
    }

    stop() {
        this.isRunning = false;
        this.isConnected = false;
        this.hybridManager.updateConnectionStatus('sharedMemory', false);
        if (this.wrapper) {
            try {
                this.wrapper = null;
            } catch (error) {
                console.log('Error deteniendo wrapper:', error.message);
            }
        }
    }
}

// VARIABLES GLOBALES PARA EL GESTOR HÍBRIDO
let hybridManager = null;
let broadcastingMonitor = null;
let sharedMemoryMonitor = null;
let isListening = false;

function initializeHybridSystem() {
    if (!libraryAvailable) {
        console.log('❌ No se puede inicializar - Librería acc-broadcast requerida');
        return null;
    }

    console.log('🔗 INICIALIZANDO SISTEMA HÍBRIDO INTELIGENTE...');

    // Crear gestor híbrido
    hybridManager = new HybridProtocolManager(io);

    // Crear monitores con el gestor híbrido
    broadcastingMonitor = new ACCBroadcastingMonitor(hybridManager);

    try {
        sharedMemoryMonitor = new ACCSharedMemoryMonitorHybrid(hybridManager);
        console.log('✅ Sistema híbrido creado exitosamente');
    } catch (error) {
        console.log('⚠️ Shared Memory no disponible:', error.message);
        sharedMemoryMonitor = null;
    }

    return {
        hybridManager,
        broadcasting: broadcastingMonitor,
        sharedMemory: sharedMemoryMonitor
    };
}

// RUTAS API MODIFICADAS
app.post('/api/start', async (req, res) => {
    try {
        if (!libraryAvailable) {
            return res.status(500).json({
                error: 'Librería acc-broadcast no disponible. Instalar con: npm install acc-broadcast'
            });
        }

        if (isListening) {
            return res.json({
                message: 'Sistema híbrido ya está activo',
                status: hybridManager?.getStatus() || {}
            });
        }

        const system = initializeHybridSystem();
        if (!system) {
            return res.status(500).json({ error: 'No se pudo inicializar el sistema híbrido' });
        }

        let broadcastingStarted = false;
        let sharedMemoryStarted = false;

        // Iniciar broadcasting
        if (system.broadcasting) {
            broadcastingStarted = system.broadcasting.start();
        }

        // Iniciar shared memory
        if (system.sharedMemory) {
            sharedMemoryStarted = await system.sharedMemory.start();
        }

        if (broadcastingStarted || sharedMemoryStarted) {
            isListening = true;
            res.json({
                message: 'Sistema híbrido iniciado',
                status: system.hybridManager.getStatus()
            });
        } else {
            res.status(500).json({ error: 'Error iniciando sistema híbrido' });
        }
    } catch (error) {
        console.error('Error iniciando:', error);
        res.status(500).json({ error: 'Error iniciando sistema híbrido' });
    }
});

app.post('/api/stop', (req, res) => {
    try {
        if (!isListening) {
            return res.json({ message: 'No hay sistema activo' });
        }

        if (broadcastingMonitor) {
            broadcastingMonitor.stop();
        }
        if (sharedMemoryMonitor) {
            sharedMemoryMonitor.stop();
        }
        if (hybridManager) {
            hybridManager.stop();
        }

        isListening = false;
        res.json({ message: 'Sistema híbrido detenido' });
    } catch (error) {
        console.error('Error deteniendo:', error);
        res.status(500).json({ error: 'Error deteniendo sistema híbrido' });
    }
});

app.get('/api/telemetry', (req, res) => {
    if (hybridManager && hybridManager.mergedData) {
        res.json(hybridManager.mergedData);
    } else {
        res.json(getDefaultTelemetryData());
    }
});

app.get('/api/status', (req, res) => {
    res.json({
        libraryAvailable: libraryAvailable,
        isRunning: isListening,
        hybridStatus: hybridManager?.getStatus() || {
            protocols: { sharedMemory: false, broadcasting: false },
            quality: { sharedMemory: 0, broadcasting: 0 },
            activeProtocol: 'none',
            lastUpdate: 0
        }
    });
});

function getDefaultTelemetryData() {
    return {
        carInfo: { carModel: 'Desconocido', carModelId: null, teamName: '', raceNumber: 0, cupCategory: '', nationality: '' },
        driverInfo: { firstName: '', lastName: '', shortName: '', category: '', nationality: '' },
        realtimeData: { speed: 0, gear: 'N', position: 0, laps: 0, delta: 0, carLocation: 0, velocity: [0, 0, 0] },
        engineData: null,
        controlsData: null,
        gForceData: null,
        tyreData: null,
        brakeData: null,
        suspensionData: null,
        aidsData: null,
        energyData: null,
        lapData: { bestSessionLap: { laptimeMS: null }, lastLap: { laptimeMS: null }, currentLap: { laptimeMS: null } },
        sessionData: { sessionType: 0, phase: 0, ambientTemp: 0, trackTemp: 0, rainLevel: 0, wetness: 0 },
        trackData: { trackName: '', trackMeters: 0 },
        lastEvent: null,
        playerInfo: null,
        timestamp: new Date(),
        isRunning: false,
        isConnected: false,
        protocol: 'none',
        hybridStatus: { sharedMemory: { connected: false, quality: 0, lastUpdate: 0 }, broadcasting: { connected: false, quality: 0, lastUpdate: 0 } }
    };
}

// Servir archivos estáticos
app.use(express.static('public'));

// Auto-start del sistema híbrido
console.log('🚀 Iniciando Sistema Híbrido ACC...');

if (libraryAvailable) {
    console.log('✅ Librería acc-broadcast disponible');

    const system = initializeHybridSystem();

    if (system) {
        console.log('🚀 Iniciando conexión automática...');

        // Iniciar broadcasting
        if (system.broadcasting && system.broadcasting.start()) {
            console.log('✅ Broadcasting iniciado automáticamente');
        }

        // Iniciar shared memory
        if (system.sharedMemory) {
            system.sharedMemory.start().then(started => {
                if (started) {
                    console.log('✅ Shared Memory iniciado automáticamente');
                } else {
                    console.log('⚠️ Shared Memory no disponible - Solo Broadcasting activo');
                }
            }).catch(error => {
                console.log('❌ Error iniciando Shared Memory:', error.message);
            });
        }

        isListening = true;

        // Mostrar información del sistema híbrido
        setTimeout(() => {
            console.log('');
            console.log('🎯 SISTEMA HÍBRIDO ACC ACTIVO');
            console.log('═'.repeat(70));
            console.log('✅ Gestor inteligente de protocolos configurado');
            console.log('📡 Broadcasting: Información oficial de carrera y multijugador');
            console.log('🧠 Memoria compartida: Telemetría ultra-detallada del jugador');
            console.log('🔄 Anti-solapamiento: Los datos se priorizan automáticamente');
            console.log('✅ Servidor corriendo en puerto 5000');
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
            console.log('🔧 VENTAJAS DEL SISTEMA HÍBRIDO INTELIGENTE:');
            console.log('   • Sin solapamiento de datos');
            console.log('   • Priorización automática por tipo de dato');
            console.log('   • Broadcasting para datos oficiales de carrera');
            console.log('   • Memoria compartida para telemetría detallada');
            console.log('   • Fallback automático entre protocolos');
            console.log('   • Máxima precisión y frecuencia');
            console.log('   • Compatible con dashboard existente');
            console.log('');
        }, 1000);
    } else {
        console.log('❌ Error inicializando sistema híbrido');
    }
} else {
    console.log('');
    console.log('❌ LIBRERÍA NO DISPONIBLE');
    console.log('═'.repeat(50));
    console.log('Esta aplicación requiere la librería acc-broadcast');
    console.log('');
    console.log('📦 INSTALACIÓN:');
    console.log('   npm install acc-broadcast');
    console.log('   npm install acc-node-wrapper');
    console.log('');
    console.log('🔄 Después de instalar, reinicia la aplicación');
    console.log('');
}

// Manejo de cierre limpio
process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando sistema híbrido...');
    if (broadcastingMonitor && isListening) {
        broadcastingMonitor.stop();
    }
    if (sharedMemoryMonitor && isListening) {
        sharedMemoryMonitor.stop();
    }
    if (hybridManager) {
        hybridManager.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Terminando sistema híbrido...');
    if (broadcastingMonitor && isListening) {
        broadcastingMonitor.stop();
    }
    if (sharedMemoryMonitor && isListening) {
        sharedMemoryMonitor.stop();
    }
    if (hybridManager) {
        hybridManager.stop();
    }
    process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
    if (broadcastingMonitor && isListening) {
        broadcastingMonitor.stop();
    }
    if (sharedMemoryMonitor && isListening) {
        sharedMemoryMonitor.stop();
    }
    if (hybridManager) {
        hybridManager.stop();
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
});

// Iniciar servidor
server.listen(PORT, () => {
    console.log('');
    console.log('🚀 SERVIDOR SISTEMA HÍBRIDO ACC ACTIVO');
    console.log('═'.repeat(50));
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`🔧 API telemetría: http://localhost:${PORT}/api/telemetry`);
    console.log(`📊 API estado: http://localhost:${PORT}/api/status`);
    console.log(`🎮 Protocolo: ${libraryAvailable ? 'Híbrido Inteligente (Anti-solapamiento)' : 'NO DISPONIBLE'}`);
    console.log(`📡 Broadcasting: ${broadcastingMonitor ? 'Disponible' : 'No disponible'}`);
    console.log(`🧠 Memoria compartida: ${sharedMemoryMonitor ? 'Disponible' : 'No disponible'}`);
    console.log(`🔄 Gestor híbrido: ${hybridManager ? 'Activo' : 'No disponible'}`);
    console.log('');
    console.log('💡 Presiona Ctrl+C para salir');
    console.log('═'.repeat(50));
});