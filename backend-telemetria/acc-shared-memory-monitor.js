// acc-shared-memory-monitor.js - CON SOCKET.IO FUNCIONANDO
const ACCNodeWrapper = require('acc-node-wrapper');

class ACCSharedMemoryMonitor {
    constructor(io) {
        this.wrapper = null;
        this.isRunning = false;
        this.isConnected = false;
        this.updateCount = 0;
        this.lastDisplayTime = 0;
        this.io = io; // Socket.IO instance

        // Estructura de datos de memoria compartida
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
            console.log('⚠️ Monitor de memoria compartida ya está ejecutándose');
            return true;
        }

        console.log('🧠 Iniciando monitor de memoria compartida...');

        try {
            this.wrapper = new ACCNodeWrapper();
            this.setupSharedMemoryEvents();

            // Usar el método original del wrapper
            this.wrapper.initSharedMemory(50, 100, 1000, false); // physics, graphics, static, logging

            this.isRunning = true;
            this.isConnected = true;

            console.log('✅ Monitor de memoria compartida iniciado');
            console.log('📊 Intervalos: Physics(50ms), Graphics(100ms), Static(1000ms)');
            console.log('🎮 ¡Conectando con ACC para obtener datos REALES!');

            return true;

        } catch (error) {
            console.error('❌ Error iniciando memoria compartida:', error.message);
            this.isRunning = false;
            this.isConnected = false;
            return false;
        }
    }

    setupSharedMemoryEvents() {
        if (!this.wrapper) return;

        // Eventos del wrapper original
        this.wrapper.on('M_PHYSICS_RESULT', (data) => this.handlePhysicsEvent(data));
        this.wrapper.on('M_GRAPHICS_RESULT', (data) => this.handleGraphicsEvent(data));
        this.wrapper.on('M_STATIC_RESULT', (data) => this.handleStaticEvent(data));

        console.log('📡 Eventos de memoria compartida configurados');
    }

    handlePhysicsEvent(data) {
        // Mapear datos REALES del juego
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

        // Mostrar datos reales cada 5 segundos
        if (this.updateCount % 100 === 0) {
            console.log(`🎮 DATOS REALES: ${this.sharedMemoryData.physics.speedKmh}km/h | RPM: ${this.sharedMemoryData.physics.rpm} | Marcha: ${this.sharedMemoryData.physics.gear}`);
        }

        // EMITIR DATOS AL FRONTEND
        this.emitTelemetry();
    }

    handleGraphicsEvent(data) {
        // Datos REALES de la interfaz del juego
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

        // EMITIR DATOS AL FRONTEND
        this.emitTelemetry();
    }

    handleStaticEvent(data) {
        // Información REAL del coche y pista
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

        if (this.sharedMemoryData.static.carModel) {
            console.log(`🏎️ COCHE REAL: ${this.sharedMemoryData.static.carModel} | Pista: ${this.sharedMemoryData.static.track}`);
            console.log(`🔧 Especificaciones: ${this.sharedMemoryData.static.maxPower}cv | ${this.sharedMemoryData.static.maxRpm}rpm | ${this.sharedMemoryData.static.maxFuel}L`);
        }
    }

    // Función CORREGIDA para strings de ACC
    safeString(value) {
        if (value === null || value === undefined) return '';

        let result = '';

        // Si es un array de caracteres (como viene de ACC)
        if (Array.isArray(value)) {
            result = value.join('');
        }
        // Si es un buffer
        else if (value instanceof Buffer) {
            result = value.toString();
        }
        // Si es string normal
        else if (typeof value === 'string') {
            result = value;
        }
        // Convertir cualquier otro tipo
        else {
            result = String(value);
        }

        // Limpiar caracteres null y espacios extra
        return result.replace(/\0/g, '').replace(/_/g, ' ').trim();
    }

    formatGear(gear) {
        if (gear === undefined || gear === null) return 'N';
        if (gear === -1) return 'R';
        if (gear === 0) return 'N';
        return gear.toString();
    }

    emitTelemetry() {
        // Crear estructura compatible con tu dashboard usando DATOS REALES
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
                trackMeters: 7004 // Spa-Francorchamps metros reales
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

        // EMITIR DATOS POR SOCKET.IO AL FRONTEND
        if (this.io) {
            this.io.emit('telemetry_update', data);
        }

        return data;
    }

    // Función CORREGIDA para parsear tiempos
    parseTimeString(timeString) {
        try {
            // Verificar si es válido
            if (!timeString || timeString.length === 0 || timeString === '--:--.---') {
                return null;
            }

            // Limpiar el string
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
        return this.emitTelemetry();
    }

    stop() {
        this.isRunning = false;
        this.isConnected = false;
        if (this.wrapper) {
            try {
                this.wrapper = null;
            } catch (error) {
                console.log('Error deteniendo wrapper:', error.message);
            }
        }
        console.log('🛑 Monitor de memoria compartida detenido');
    }
}

module.exports = { ACCSharedMemoryMonitor };