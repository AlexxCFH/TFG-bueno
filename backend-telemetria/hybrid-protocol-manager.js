// hybrid-protocol-manager.js - GESTOR INTELIGENTE DE PROTOCOLOS
class HybridProtocolManager {
    constructor(io) {
        this.io = io;
        this.protocols = {
            sharedMemory: null,
            broadcasting: null
        };
        
        this.connectionStatus = {
            sharedMemory: false,
            broadcasting: false
        };
        
        this.dataQuality = {
            sharedMemory: 0,
            broadcasting: 0
        };
        
        this.lastDataTimestamp = {
            sharedMemory: 0,
            broadcasting: 0
        };
        
        this.dataBuffer = {
            sharedMemory: null,
            broadcasting: null
        };
        
        // Configuración de prioridades
        this.priorities = {
            // Telemetría detallada - Prioridad: Memoria Compartida
            physics: 'sharedMemory',
            controls: 'sharedMemory',
            engine: 'sharedMemory',
            tyres: 'sharedMemory',
            forces: 'sharedMemory',
            suspension: 'sharedMemory',
            aids: 'sharedMemory',
            
            // Información de carrera - Prioridad: Broadcasting
            carInfo: 'broadcasting',
            driverInfo: 'broadcasting',
            racePosition: 'broadcasting',
            lapTimes: 'broadcasting',
            sessionInfo: 'broadcasting',
            trackInfo: 'broadcasting',
            
            // Datos básicos - Usar el mejor disponible
            speed: 'auto',
            gear: 'auto',
            rpm: 'auto'
        };
        
        this.mergedData = null;
        this.emitInterval = null;
        this.startMergedDataEmitter();
    }

    registerProtocol(type, protocolInstance) {
        this.protocols[type] = protocolInstance;
        console.log(`✅ Protocolo ${type} registrado en el gestor híbrido`);
    }

    updateConnectionStatus(type, isConnected) {
        const wasConnected = this.connectionStatus[type];
        this.connectionStatus[type] = isConnected;
        
        if (isConnected && !wasConnected) {
            console.log(`🟢 Protocolo ${type} conectado`);
            this.evaluateDataQuality(type);
        } else if (!isConnected && wasConnected) {
            console.log(`🔴 Protocolo ${type} desconectado`);
            this.dataQuality[type] = 0;
        }
    }

    evaluateDataQuality(type) {
        let quality = 0;
        
        if (type === 'sharedMemory') {
            quality = 95; // Máxima calidad para telemetría detallada
        } else if (type === 'broadcasting') {
            quality = 90; // Alta calidad para datos oficiales de carrera
        }
        
        this.dataQuality[type] = quality;
        console.log(`📊 Calidad de datos ${type}: ${quality}%`);
    }

    processData(type, data) {
        if (!data || !this.connectionStatus[type]) {
            return;
        }

        // Actualizar timestamp y buffer
        this.lastDataTimestamp[type] = Date.now();
        this.dataBuffer[type] = data;
        
        // Procesar datos inmediatamente para merge
        this.mergeData();
    }

    mergeData() {
        const sharedMemoryData = this.dataBuffer.sharedMemory;
        const broadcastingData = this.dataBuffer.broadcasting;
        
        // Si no hay datos de ningún protocolo, usar datos por defecto
        if (!sharedMemoryData && !broadcastingData) {
            this.mergedData = this.getDefaultData();
            return;
        }

        // Crear estructura de datos merged
        const merged = {
            // === METADATOS ===
            timestamp: new Date(),
            isRunning: sharedMemoryData?.isRunning || broadcastingData?.isRunning || false,
            isConnected: this.connectionStatus.sharedMemory || this.connectionStatus.broadcasting,
            protocol: this.determineActiveProtocol(),
            hybridStatus: {
                sharedMemory: {
                    connected: this.connectionStatus.sharedMemory,
                    quality: this.dataQuality.sharedMemory,
                    lastUpdate: this.lastDataTimestamp.sharedMemory
                },
                broadcasting: {
                    connected: this.connectionStatus.broadcasting,
                    quality: this.dataQuality.broadcasting,
                    lastUpdate: this.lastDataTimestamp.broadcasting
                }
            },

            // === INFORMACIÓN DEL COCHE (Broadcasting Priority) ===
            carInfo: this.selectBestData('carInfo', sharedMemoryData?.carInfo, broadcastingData?.carInfo),
            driverInfo: this.selectBestData('driverInfo', sharedMemoryData?.driverInfo, broadcastingData?.driverInfo),

            // === DATOS EN TIEMPO REAL (Smart Merge) ===
            realtimeData: this.mergeRealtimeData(sharedMemoryData, broadcastingData),

            // === DATOS DE MOTOR (Shared Memory Priority) ===
            engineData: sharedMemoryData?.extendedData?.physics ? {
                rpm: sharedMemoryData.extendedData.physics.rpm || 0,
                engineTemp: sharedMemoryData.extendedData.physics.engineTemp || 0,
                turboBoost: sharedMemoryData.extendedData.physics.turboBoost || 0,
                fuel: sharedMemoryData.extendedData.physics.fuel || 0,
                maxRpm: sharedMemoryData.extendedData.static?.maxRpm || 8000,
                maxPower: sharedMemoryData.extendedData.static?.maxPower || 0,
                maxFuel: sharedMemoryData.extendedData.static?.maxFuel || 100
            } : null,

            // === CONTROLES (Shared Memory Only) ===
            controlsData: sharedMemoryData?.extendedData?.physics ? {
                throttle: sharedMemoryData.extendedData.physics.gas || 0,
                brake: sharedMemoryData.extendedData.physics.brake || 0,
                clutch: sharedMemoryData.extendedData.physics.clutch || 0,
                steerAngle: sharedMemoryData.extendedData.physics.steerAngle || 0
            } : null,

            // === FUERZAS G (Shared Memory Only) ===
            gForceData: sharedMemoryData?.extendedData?.physics?.accG ? {
                longitudinal: sharedMemoryData.extendedData.physics.accG[2] || 0,
                lateral: sharedMemoryData.extendedData.physics.accG[0] || 0,
                vertical: sharedMemoryData.extendedData.physics.accG[1] || 0
            } : null,

            // === NEUMÁTICOS (Shared Memory Priority) ===
            tyreData: sharedMemoryData?.extendedData?.physics ? {
                compound: sharedMemoryData.extendedData.graphics?.tyreCompound || 'Desconocido',
                temperatures: sharedMemoryData.extendedData.physics.tyreCoreTemperature || [0, 0, 0, 0],
                pressures: sharedMemoryData.extendedData.physics.wheelsPressure || [0, 0, 0, 0]
            } : null,

            // === FRENOS (Shared Memory Priority) ===
            brakeData: sharedMemoryData?.extendedData?.physics ? {
                temperatures: sharedMemoryData.extendedData.physics.brakeTemp || [0, 0, 0, 0],
                bias: sharedMemoryData.extendedData.physics.brakeBias || 0.5
            } : null,

            // === SUSPENSIÓN (Shared Memory Only) ===
            suspensionData: sharedMemoryData?.extendedData?.physics ? {
                rideHeight: sharedMemoryData.extendedData.physics.rideHeight || [0, 0],
                travel: sharedMemoryData.extendedData.physics.suspensionTravel || [0, 0, 0, 0]
            } : null,

            // === ASISTENCIAS (Shared Memory Priority) ===
            aidsData: sharedMemoryData?.extendedData?.physics ? {
                abs: {
                    level: sharedMemoryData.extendedData.physics.abs || 0,
                    active: sharedMemoryData.extendedData.physics.absInAction || 0
                },
                tc: {
                    level: sharedMemoryData.extendedData.physics.tc || 0,
                    active: sharedMemoryData.extendedData.physics.tcinAction || 0
                },
                autoShifter: sharedMemoryData.extendedData.physics.autoShifterOn || 0,
                pitLimiter: sharedMemoryData.extendedData.physics.pitLimiterOn || 0
            } : null,

            // === SISTEMAS ENERGÉTICOS (Shared Memory Only) ===
            energyData: sharedMemoryData?.extendedData?.static ? {
                hasERS: sharedMemoryData.extendedData.static.hasERS || 0,
                hasKERS: sharedMemoryData.extendedData.static.hasKERS || 0,
                hasDRS: sharedMemoryData.extendedData.static.hasDRS || 0,
                ers: sharedMemoryData.extendedData?.physics ? {
                    isCharging: sharedMemoryData.extendedData.physics.ersIsCharging || 0,
                    recoveryLevel: sharedMemoryData.extendedData.physics.ersRecoveryLevel || 0,
                    powerLevel: sharedMemoryData.extendedData.physics.ersPowerLevel || 0
                } : null,
                kers: sharedMemoryData.extendedData?.physics ? {
                    currentKJ: sharedMemoryData.extendedData.physics.kersCurrentKJ || 0,
                    maxKJ: sharedMemoryData.extendedData.physics.kersMaxKJ || 0,
                    input: sharedMemoryData.extendedData.physics.kersInput || 0
                } : null,
                drs: sharedMemoryData.extendedData?.physics ? {
                    active: sharedMemoryData.extendedData.physics.drs || 0
                } : null
            } : null,

            // === TIEMPOS DE VUELTA (Broadcasting Priority) ===
            lapData: this.selectBestData('lapTimes', sharedMemoryData?.lapData, broadcastingData?.lapData),

            // === DATOS DE SESIÓN (Broadcasting Priority) ===
            sessionData: this.selectBestData('sessionInfo', sharedMemoryData?.sessionData, broadcastingData?.sessionData),

            // === DATOS DEL CIRCUITO (Broadcasting Priority) ===
            trackData: this.selectBestData('trackInfo', sharedMemoryData?.trackData, broadcastingData?.trackData),

            // === EVENTOS (Broadcasting Only) ===
            lastEvent: broadcastingData?.lastEvent || null,

            // === INFORMACIÓN DEL JUGADOR (Broadcasting Priority) ===
            playerInfo: broadcastingData ? {
                carIndex: broadcastingData.playerCarIndex || null,
                identified: broadcastingData.playerCarIdentified || false,
                allCarsCount: broadcastingData.allCarsCount || 0
            } : null
        };

        this.mergedData = merged;
    }

    mergeRealtimeData(sharedMemoryData, broadcastingData) {
        const realtimeData = {};

        // VELOCIDAD - Usar el más preciso (Shared Memory > Broadcasting)
        if (sharedMemoryData?.extendedData?.physics?.speedKmh !== undefined) {
            realtimeData.speed = Math.round(sharedMemoryData.extendedData.physics.speedKmh);
        } else if (broadcastingData?.realtimeData?.speed !== undefined) {
            realtimeData.speed = Math.round(broadcastingData.realtimeData.speed);
        } else {
            realtimeData.speed = 0;
        }

        // MARCHA - Usar el más preciso (Shared Memory > Broadcasting)
        if (sharedMemoryData?.extendedData?.physics?.gear !== undefined) {
            realtimeData.gear = this.formatGear(sharedMemoryData.extendedData.physics.gear);
        } else if (broadcastingData?.realtimeData?.gear !== undefined) {
            realtimeData.gear = broadcastingData.realtimeData.gear;
        } else {
            realtimeData.gear = 'N';
        }

        // POSICIÓN - Broadcasting es más confiable
        if (broadcastingData?.realtimeData?.position !== undefined) {
            realtimeData.position = broadcastingData.realtimeData.position;
        } else if (sharedMemoryData?.extendedData?.graphics?.position !== undefined) {
            realtimeData.position = sharedMemoryData.extendedData.graphics.position;
        } else {
            realtimeData.position = 0;
        }

        // VUELTAS - Broadcasting es más confiable
        if (broadcastingData?.realtimeData?.laps !== undefined) {
            realtimeData.laps = broadcastingData.realtimeData.laps;
        } else if (sharedMemoryData?.extendedData?.graphics?.completedLaps !== undefined) {
            realtimeData.laps = sharedMemoryData.extendedData.graphics.completedLaps;
        } else {
            realtimeData.laps = 0;
        }

        // DELTA - Broadcasting es más preciso
        if (broadcastingData?.realtimeData?.delta !== undefined) {
            realtimeData.delta = broadcastingData.realtimeData.delta;
        } else if (sharedMemoryData?.extendedData?.graphics?.deltaLapTime !== undefined) {
            realtimeData.delta = sharedMemoryData.extendedData.graphics.deltaLapTime * 1000;
        } else {
            realtimeData.delta = 0;
        }

        // UBICACIÓN - Ambos protocolos pueden proporcionar esto
        if (broadcastingData?.realtimeData?.carLocation !== undefined) {
            realtimeData.carLocation = broadcastingData.realtimeData.carLocation;
        } else if (sharedMemoryData?.extendedData?.graphics?.isInPit !== undefined) {
            realtimeData.carLocation = sharedMemoryData.extendedData.graphics.isInPit ? 2 : 1;
        } else {
            realtimeData.carLocation = 0;
        }

        // VELOCIDAD 3D - Solo Shared Memory
        if (sharedMemoryData?.realtimeData?.velocity) {
            realtimeData.velocity = sharedMemoryData.realtimeData.velocity;
        } else {
            realtimeData.velocity = [0, 0, realtimeData.speed / 3.6];
        }

        return realtimeData;
    }

    selectBestData(category, sharedMemoryData, broadcastingData) {
        const priority = this.priorities[category];
        
        if (priority === 'sharedMemory') {
            return sharedMemoryData || broadcastingData || null;
        } else if (priority === 'broadcasting') {
            return broadcastingData || sharedMemoryData || null;
        } else { // 'auto'
            // Usar el protocolo con mejor calidad de datos
            if (this.dataQuality.sharedMemory > this.dataQuality.broadcasting) {
                return sharedMemoryData || broadcastingData || null;
            } else {
                return broadcastingData || sharedMemoryData || null;
            }
        }
    }

    determineActiveProtocol() {
        if (this.connectionStatus.sharedMemory && this.connectionStatus.broadcasting) {
            return 'hybrid';
        } else if (this.connectionStatus.sharedMemory) {
            return 'shared_memory';
        } else if (this.connectionStatus.broadcasting) {
            return 'broadcasting';
        } else {
            return 'none';
        }
    }

    formatGear(gear) {
        if (gear === undefined || gear === null) return 'N';
        if (gear === -1) return 'R';
        if (gear === 0) return 'N';
        return gear.toString();
    }

    startMergedDataEmitter() {
        // Emitir datos merged cada 50ms para suavidad
        this.emitInterval = setInterval(() => {
            if (this.mergedData && this.io) {
                this.io.emit('telemetry_update', this.mergedData);
            }
        }, 50);
    }

    getDefaultData() {
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
            hybridStatus: {
                sharedMemory: { connected: false, quality: 0, lastUpdate: 0 },
                broadcasting: { connected: false, quality: 0, lastUpdate: 0 }
            }
        };
    }

    stop() {
        if (this.emitInterval) {
            clearInterval(this.emitInterval);
            this.emitInterval = null;
        }
        console.log('🛑 Gestor de protocolo híbrido detenido');
    }

    getStatus() {
        return {
            protocols: this.connectionStatus,
            quality: this.dataQuality,
            activeProtocol: this.determineActiveProtocol(),
            lastUpdate: Math.max(this.lastDataTimestamp.sharedMemory, this.lastDataTimestamp.broadcasting)
        };
    }
}

module.exports = { HybridProtocolManager };