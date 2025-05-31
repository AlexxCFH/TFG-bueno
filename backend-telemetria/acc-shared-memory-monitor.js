// acc-shared-memory-monitor.js - SOLUCIÓN COMPLETA PARA NEUMÁTICOS
const ACCNodeWrapper = require('acc-node-wrapper');

class ACCSharedMemoryMonitor {
    constructor(io) {
        this.wrapper = null;
        this.isRunning = false;
        this.isConnected = false;
        this.updateCount = 0;
        this.lastDisplayTime = 0;
        this.io = io;
        this.debugCount = 0;
        this.lastDebugTime = 0;

        // Estructura de datos de memoria compartida
        this.sharedMemoryData = {
            physics: {
                gas: 0, brake: 0, fuel: 0, gear: 0, rpm: 0, speedKmh: 0,
                accG: [0, 0, 0], 
                
                // NEUMÁTICOS - Campos múltiples
                tyreCoreTemperature: [0, 0, 0, 0],
                tyreWear: [0, 0, 0, 0],
                tyreDirtLevel: [0, 0, 0, 0],
                wheelsPressure: [0, 0, 0, 0],
                
                // FRENOS
                brakeTemp: [0, 0, 0, 0],
                brakeBias: 0.5,
                
                // SUSPENSIÓN
                rideHeight: [0, 0],
                suspensionTravel: [0, 0, 0, 0],
                
                // MOTOR
                engineTemp: 0, airTemp: 0, roadTemp: 0, steerAngle: 0,
                clutch: 0, turboBoost: 0,
                
                // ASISTENCIAS
                abs: 0, tc: 0, autoShifterOn: 0, pitLimiterOn: 0,
                absInAction: 0, tcinAction: 0,
                
                // ENERGÍA
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

        console.log('🧠 Iniciando monitor de memoria compartida con DETECCIÓN AVANZADA...');

        try {
            this.wrapper = new ACCNodeWrapper();
            this.setupSharedMemoryEvents();

            // CONFIGURACIÓN OPTIMIZADA para capturar datos de neumáticos
            // Frecuencia más alta para physics (20ms) para capturar mejor los neumáticos
            this.wrapper.initSharedMemory(20, 100, 1000, false);

            this.isRunning = true;
            this.isConnected = true;

            console.log('✅ Monitor iniciado con frecuencia optimizada');
            console.log('📊 Intervalos: Physics(20ms), Graphics(100ms), Static(1000ms)');
            console.log('🛞 Detección avanzada de neumáticos activada');

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

        this.wrapper.on('M_PHYSICS_RESULT', (data) => this.handlePhysicsEventAdvanced(data));
        this.wrapper.on('M_GRAPHICS_RESULT', (data) => this.handleGraphicsEventAdvanced(data));
        this.wrapper.on('M_STATIC_RESULT', (data) => this.handleStaticEvent(data));

        console.log('📡 Eventos de memoria compartida con detección avanzada configurados');
    }

    handlePhysicsEventAdvanced(data) {
        this.debugCount++;
        const now = Date.now();
        
        // DEBUG COMPLETO cada 10 segundos
        if (now - this.lastDebugTime > 10000) {
            this.lastDebugTime = now;
            this.performCompleteDebug(data);
        }

        // === CAPTURA AVANZADA DE NEUMÁTICOS ===
        const tyreData = this.extractTyreDataAdvanced(data);
        const suspensionData = this.extractSuspensionDataAdvanced(data);
        const brakeData = this.extractBrakeDataAdvanced(data);

        // Mapear datos con la información extraída
        this.sharedMemoryData.physics = {
            // Datos básicos
            gas: this.validateNumber(data.gas, 0),
            brake: this.validateNumber(data.brake, 0),
            fuel: this.validateNumber(data.fuel, 0),
            gear: this.formatGear(data.gear),
            rpm: Math.round(this.validateNumber(data.rpms, 0)),
            speedKmh: Math.round(this.validateNumber(data.speedKmh, 0)),
            
            // Fuerzas G
            accG: this.validateArray(data.accG, [0, 0, 0]),
            
            // === NEUMÁTICOS (DATOS AVANZADOS) ===
            tyreCoreTemperature: tyreData.temperatures,
            tyreWear: tyreData.wear,
            tyreDirtLevel: tyreData.dirt,
            wheelsPressure: tyreData.pressures,
            
            // === FRENOS (DATOS AVANZADOS) ===
            brakeTemp: brakeData.temperatures,
            brakeBias: brakeData.bias,
            
            // === SUSPENSIÓN (DATOS AVANZADOS) ===
            rideHeight: suspensionData.heights,
            suspensionTravel: suspensionData.travels,
            
            // Motor y otros
            engineTemp: this.validateNumber(data.engineTemp, 0),
            airTemp: this.validateNumber(data.airTemp, 0),
            roadTemp: this.validateNumber(data.roadTemp, 0),
            steerAngle: this.validateNumber(data.steerAngle, 0),
            clutch: this.validateNumber(data.clutch, 0),
            turboBoost: this.validateNumber(data.turboBoost, 0),
            
            // Asistencias
            abs: this.validateNumber(data.abs, 0),
            tc: this.validateNumber(data.tc, 0),
            autoShifterOn: this.validateNumber(data.autoShifterOn, 0),
            pitLimiterOn: this.validateNumber(data.pitLimiterOn, 0),
            absInAction: this.validateNumber(data.absInAction, 0),
            tcinAction: this.validateNumber(data.tcinAction, 0),
            
            // Sistemas energéticos
            ersIsCharging: this.validateNumber(data.ersIsCharging, 0),
            ersRecoveryLevel: this.validateNumber(data.ersRecoveryLevel, 0),
            ersPowerLevel: this.validateNumber(data.ersPowerLevel, 0),
            kersCurrentKJ: this.validateNumber(data.kersCurrentKJ, 0),
            kersMaxKJ: this.validateNumber(data.kersMaxKJ, 0),
            kersInput: this.validateNumber(data.kersInput, 0),
            drs: this.validateNumber(data.drs, 0)
        };

        this.updateCount++;

        // Mostrar estado de neumáticos cada 5 segundos
        if (this.updateCount % 250 === 0) { // 250 * 20ms = 5 segundos
            this.showTyreStatus();
        }

        this.emitTelemetry();
    }

    // === EXTRACCIÓN AVANZADA DE DATOS DE NEUMÁTICOS ===
    extractTyreDataAdvanced(data) {
        const result = {
            temperatures: [0, 0, 0, 0],
            pressures: [0, 0, 0, 0],
            wear: [0, 0, 0, 0],
            dirt: [0, 0, 0, 0]
        };

        // Lista de posibles campos para temperaturas de neumáticos
        const tempFields = [
            'tyreCoreTemperature',
            'tyreTemp',
            'wheelTemp',
            'tyreTemperature',
            'coreTemp',
            'tyreCore'
        ];

        // Lista de posibles campos para presiones
        const pressureFields = [
            'wheelsPressure',
            'tyrePressure',
            'pressure',
            'tyrePress',
            'wheelPress'
        ];

        // Lista de posibles campos para desgaste
        const wearFields = [
            'tyreWear',
            'wear',
            'wheelWear',
            'tyreDegradation',
            'degradation'
        ];

        // Lista de posibles campos para suciedad
        const dirtFields = [
            'tyreDirtLevel',
            'dirt',
            'tyreDirt',
            'wheelDirt',
            'dirtLevel'
        ];

        // Intentar extraer temperaturas
        for (const field of tempFields) {
            if (data[field] && Array.isArray(data[field]) && data[field].length >= 4) {
                result.temperatures = data[field].slice(0, 4).map(temp => {
                    const num = this.validateNumber(temp, 0);
                    return (num > 0 && num < 200) ? num : 0;
                });
                break;
            }
        }

        // Intentar extraer presiones
        for (const field of pressureFields) {
            if (data[field] && Array.isArray(data[field]) && data[field].length >= 4) {
                result.pressures = data[field].slice(0, 4).map(pressure => {
                    const num = this.validateNumber(pressure, 0);
                    return (num > 0 && num < 60) ? num : 0;
                });
                break;
            }
        }

        // Intentar extraer desgaste
        for (const field of wearFields) {
            if (data[field] && Array.isArray(data[field]) && data[field].length >= 4) {
                result.wear = data[field].slice(0, 4).map(wear => {
                    const num = this.validateNumber(wear, 0);
                    return (num >= 0 && num <= 100) ? num : 0;
                });
                break;
            }
        }

        // Intentar extraer suciedad
        for (const field of dirtFields) {
            if (data[field] && Array.isArray(data[field]) && data[field].length >= 4) {
                result.dirt = data[field].slice(0, 4).map(dirt => {
                    const num = this.validateNumber(dirt, 0);
                    return (num >= 0 && num <= 100) ? num : 0;
                });
                break;
            }
        }

        return result;
    }

    // === EXTRACCIÓN AVANZADA DE DATOS DE SUSPENSIÓN ===
    extractSuspensionDataAdvanced(data) {
        const result = {
            heights: [0, 0],
            travels: [0, 0, 0, 0]
        };

        // Campos posibles para altura de marcha
        const heightFields = [
            'rideHeight',
            'suspensionHeight',
            'carHeight',
            'height',
            'rideHeights'
        ];

        // Campos posibles para recorrido de suspensión
        const travelFields = [
            'suspensionTravel',
            'wheelTravel',
            'suspTravel',
            'travel',
            'suspensionPosition'
        ];

        // Intentar extraer alturas
        for (const field of heightFields) {
            if (data[field] && Array.isArray(data[field]) && data[field].length >= 2) {
                result.heights = data[field].slice(0, 2).map(height => {
                    const num = this.validateNumber(height, 0);
                    return (num >= 0 && num < 300) ? num : 0;
                });
                break;
            }
        }

        // Intentar extraer recorridos
        for (const field of travelFields) {
            if (data[field] && Array.isArray(data[field]) && data[field].length >= 4) {
                result.travels = data[field].slice(0, 4).map(travel => {
                    const num = this.validateNumber(travel, 0);
                    return (num > -200 && num < 200) ? num : 0;
                });
                break;
            }
        }

        return result;
    }

    // === EXTRACCIÓN AVANZADA DE DATOS DE FRENOS ===
    extractBrakeDataAdvanced(data) {
        const result = {
            temperatures: [0, 0, 0, 0],
            bias: 0.5
        };

        // Campos posibles para temperaturas de frenos
        const tempFields = [
            'brakeTemp',
            'brakeDiscTemp',
            'discTemp',
            'brakeTemperature',
            'brakeDiskTemp'
        ];

        // Intentar extraer temperaturas de frenos
        for (const field of tempFields) {
            if (data[field] && Array.isArray(data[field]) && data[field].length >= 4) {
                result.temperatures = data[field].slice(0, 4).map(temp => {
                    const num = this.validateNumber(temp, 0);
                    return (num >= 0 && num < 1200) ? num : 0;
                });
                break;
            }
        }

        // Balance de frenos
        result.bias = this.validateNumber(data.brakeBias, 0.5);

        return result;
    }

    // === DEBUG COMPLETO ===
    performCompleteDebug(data) {
        console.log('\n🔍 === DEBUG COMPLETO DE MEMORIA COMPARTIDA ===');
        console.log(`📊 Update #${this.updateCount} | Velocidad: ${Math.round(data.speedKmh || 0)}km/h`);
        
        // Mostrar todas las propiedades disponibles
        const allKeys = Object.keys(data).sort();
        console.log(`📋 Total de propiedades: ${allKeys.length}`);
        
        // Buscar propiedades relacionadas con neumáticos
        const tyreKeys = allKeys.filter(key => 
            key.toLowerCase().includes('tyre') || 
            key.toLowerCase().includes('tire') || 
            key.toLowerCase().includes('wheel') ||
            key.toLowerCase().includes('pressure') ||
            key.toLowerCase().includes('temp') ||
            key.toLowerCase().includes('wear') ||
            key.toLowerCase().includes('dirt')
        );
        
        console.log('\n🛞 PROPIEDADES RELACIONADAS CON NEUMÁTICOS:');
        tyreKeys.forEach(key => {
            const value = data[key];
            if (Array.isArray(value)) {
                console.log(`   ${key}: [${value.join(', ')}]`);
            } else {
                console.log(`   ${key}: ${value}`);
            }
        });
        
        // Buscar propiedades relacionadas con suspensión
        const suspKeys = allKeys.filter(key => 
            key.toLowerCase().includes('susp') || 
            key.toLowerCase().includes('ride') || 
            key.toLowerCase().includes('height') ||
            key.toLowerCase().includes('travel')
        );
        
        console.log('\n🔧 PROPIEDADES RELACIONADAS CON SUSPENSIÓN:');
        suspKeys.forEach(key => {
            const value = data[key];
            if (Array.isArray(value)) {
                console.log(`   ${key}: [${value.join(', ')}]`);
            } else {
                console.log(`   ${key}: ${value}`);
            }
        });
        
        console.log('═'.repeat(60));
    }

    showTyreStatus() {
        const physics = this.sharedMemoryData.physics;
        console.log('\n🛞 === ESTADO ACTUAL DE NEUMÁTICOS ===');
        console.log(`   Temperaturas: [${physics.tyreCoreTemperature.map(t => Math.round(t)).join('°C, ')}°C]`);
        console.log(`   Presiones: [${physics.wheelsPressure.map(p => p.toFixed(1)).join(', ')} psi]`);
        console.log(`   Desgaste: [${physics.tyreWear.map(w => w.toFixed(1)).join('%, ')}%]`);
        console.log(`   Compuesto: ${this.sharedMemoryData.graphics.tyreCompound || 'No detectado'}`);
        
        // Mostrar si hay datos válidos
        const hasValidTemps = physics.tyreCoreTemperature.some(t => t > 0);
        const hasValidPressures = physics.wheelsPressure.some(p => p > 0);
        const hasValidWear = physics.tyreWear.some(w => w > 0);
        
        console.log(`   Estado: Temps=${hasValidTemps ? '✅' : '❌'} | Presiones=${hasValidPressures ? '✅' : '❌'} | Desgaste=${hasValidWear ? '✅' : '❌'}`);
        console.log('═'.repeat(50));
    }

    handleGraphicsEventAdvanced(data) {
        // Capturar datos gráficos con foco en compuesto de neumáticos
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
            tyreCompound: this.extractTyreCompound(data),
            rainIntensity: data.rainIntensity || 0,
            trackGripStatus: data.trackGripStatus || 1.0
        };

        this.emitTelemetry();
    }

    extractTyreCompound(data) {
        // Intentar múltiples campos para el compuesto
        const compoundFields = [
            'tyreCompound',
            'compound',
            'tyre',
            'tire',
            'currentTyre'
        ];

        for (const field of compoundFields) {
            if (data[field]) {
                const compound = this.safeString(data[field]);
                if (compound && compound.length > 0) {
                    return compound;
                }
            }
        }

        return 'dry compound';
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

    validateNumber(value, defaultValue = 0) {
        if (value === null || value === undefined || isNaN(value)) {
            return defaultValue;
        }
        const num = Number(value);
        return isFinite(num) ? num : defaultValue;
    }

    validateArray(value, defaultValue = []) {
        if (!Array.isArray(value)) {
            return defaultValue;
        }
        return value;
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

    emitTelemetry() {
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

        if (this.io) {
            this.io.emit('telemetry_update', data);
        }

        return data;
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