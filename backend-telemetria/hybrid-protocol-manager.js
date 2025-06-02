// hybrid-protocol-manager.js - GESTOR INTELIGENTE DE PROTOCOLOS CON CAMPOS REALES DE ACC
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
        this.lastMergeDebug = 0;
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

    // === FUNCIÓN DE DEBUG PARA NEUMÁTICOS ===
    debugTyreDataMerge(sharedMemoryData) {
        // Debug cada 10 segundos para verificar el merge
        if (!this.lastMergeDebug || Date.now() - this.lastMergeDebug > 10000) {
            this.lastMergeDebug = Date.now();
            
            console.log('\n🔄 === DEBUG MERGE NEUMÁTICOS ===');
            
            if (sharedMemoryData?.extendedData?.physics) {
                const physics = sharedMemoryData.extendedData.physics;
                
                console.log('📊 Datos recibidos en el merge:');
                console.log('- TyreCoreTemp:', physics.TyreCoreTemp ? `[${physics.TyreCoreTemp.slice(0,4).map(t => t.toFixed(1)).join('°C, ')}°C]` : '❌');
                console.log('- wheelPressure:', physics.wheelPressure ? `[${physics.wheelPressure.slice(0,4).map(p => p.toFixed(1)).join(', ')} psi]` : '❌');
                console.log('- wheelSlip:', physics.wheelSlip ? `[${physics.wheelSlip.slice(0,4).map(w => (w*100).toFixed(1)).join('%, ')}%]` : '❌');
                console.log('- slipRatio:', physics.slipRatio ? `[${physics.slipRatio.slice(0,4).map(s => Math.abs(s*100).toFixed(1)).join('%, ')}%]` : '❌');
                
                // Verificar si tyreData se crea correctamente
                const tyreData = {
                    compound: this.extractTyreCompound(sharedMemoryData.extendedData.graphics),
                    temperatures: physics.TyreCoreTemp || [0, 0, 0, 0],
                    pressures: physics.wheelPressure || [0, 0, 0, 0],
                    wear: physics.wheelSlip || [0, 0, 0, 0],
                    dirt: physics.slipRatio || [0, 0, 0, 0]
                };
                
                console.log('🛞 tyreData creado:', {
                    compound: tyreData.compound,
                    hasTemperatures: tyreData.temperatures.some(t => t > 0),
                    hasPressures: tyreData.pressures.some(p => p > 0),
                    hasWear: tyreData.wear.some(w => w > 0),
                    hasDirt: tyreData.dirt.some(d => d > 0)
                });
                
            } else {
                console.log('❌ No hay extendedData.physics en sharedMemoryData');
            }
            
            console.log('═'.repeat(50));
        }
    }

    mergeData() {
        const sharedMemoryData = this.dataBuffer.sharedMemory;
        const broadcastingData = this.dataBuffer.broadcasting;
        
        // Si no hay datos de ningún protocolo, usar datos por defecto
        if (!sharedMemoryData && !broadcastingData) {
            this.mergedData = this.getDefaultData();
            return;
        }

        // DEBUG para neumáticos
        if (sharedMemoryData?.extendedData?.physics) {
            this.debugTyreDataMerge(sharedMemoryData);
        }

        // Crear estructura de datos merged
        const merged = {
            // === METADATOS ===
            timestamp: new Date(),
            isRunning: sharedMemoryData?.isRunning || broadcastingData?.isRunning || false,
            isConnected: this.connectionStatus.sharedMemory || this.connectionStatus.broadcasting,
            protocol: this.determineActiveProtocol(),
            hybridStatus: {
                protocols: {
                    sharedMemory: this.connectionStatus.sharedMemory,
                    broadcasting: this.connectionStatus.broadcasting
                },
                quality: {
                    sharedMemory: this.dataQuality.sharedMemory,
                    broadcasting: this.dataQuality.broadcasting
                },
                activeProtocol: this.determineActiveProtocol()
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

            // === NEUMÁTICOS (CORREGIDO CON CAMPOS REALES DEL TEST) ===
            tyreData: sharedMemoryData?.extendedData?.physics ? {
                compound: this.extractTyreCompound(sharedMemoryData.extendedData.graphics),
                temperatures: sharedMemoryData.extendedData.physics.TyreCoreTemp || [0, 0, 0, 0],    // ✅ Campo real del test
                pressures: sharedMemoryData.extendedData.physics.wheelPressure || [0, 0, 0, 0],      // ✅ Campo real del test
                wear: sharedMemoryData.extendedData.physics.wheelSlip || [0, 0, 0, 0],               // ✅ Campo real del test
                dirt: sharedMemoryData.extendedData.physics.slipRatio || [0, 0, 0, 0]                // ✅ Campo real del test
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
            } : null,

            // === DATOS EXTENDIDOS PARA DEBUG ===
            extendedData: sharedMemoryData?.extendedData || null
        };

        this.mergedData = merged;
    }

    // === FUNCIÓN PARA OBTENER LAS MEJORES PRESIONES (SIN LOGS EN BUCLE) ===
    getBestPressures(physics, graphics) {
        // Prioridad 1: Presiones del MFD (más precisas según el test)
        if (graphics && 
            graphics.mfdTyrePressureLF !== undefined && 
            graphics.mfdTyrePressureRF !== undefined && 
            graphics.mfdTyrePressureLR !== undefined && 
            graphics.mfdTyrePressureRR !== undefined) {
            
            const mfdPressures = [
                graphics.mfdTyrePressureLF,
                graphics.mfdTyrePressureRF,
                graphics.mfdTyrePressureLR,
                graphics.mfdTyrePressureRR
            ];
            
            // Verificar que sean valores razonables (15-50 psi)
            if (mfdPressures.every(p => p > 15 && p < 50)) {
                return mfdPressures;
            }
        }
        
        // Prioridad 2: wheelPressure de physics (encontrado en el test)
        if (physics && physics.wheelPressure && Array.isArray(physics.wheelPressure)) {
            const wheelPressures = physics.wheelPressure.slice(0, 4);
            if (wheelPressures.some(p => p > 0)) {
                return wheelPressures;
            }
        }
        
        // Prioridad 3: Fallback a wheelsPressure (por compatibilidad)
        if (physics && physics.wheelsPressure && Array.isArray(physics.wheelsPressure)) {
            return physics.wheelsPressure.slice(0, 4);
        }
        
        // Fallback final
        return [0, 0, 0, 0];
    }

    // === FUNCIÓN PARA EXTRAER COMPUESTO DE NEUMÁTICOS (SIN LOGS EN BUCLE) ===
    extractTyreCompound(graphics) {
        if (!graphics) return 'Desconocido';
        
        // Extraer compuesto del formato encontrado en el test: "d,r,y,_,c,o,m,p,o,u,n,d"
        if (graphics.tyreCompound) {
            let compound = graphics.tyreCompound;
            
            // Si es array, convertir a string
            if (Array.isArray(compound)) {
                compound = compound.join('');
            }
            
            // Limpiar formato específico de ACC
            compound = compound.toString()
                .replace(/,/g, '')           // Quitar comas
                .replace(/_/g, ' ')          // Convertir _ a espacios
                .replace(/\0/g, '')          // Quitar caracteres nulos
                .trim();                     // Limpiar espacios
            
            if (compound && compound.length > 2) {
                // Capitalizar primera letra
                return compound.charAt(0).toUpperCase() + compound.slice(1).toLowerCase();
            }
        }
        
        // Información adicional basada en el test
        if (graphics.rainTyres === true) {
            return 'Neumático de lluvia';
        } else if (graphics.rainTyres === false && graphics.currentTyreSet !== undefined) {
            return `Set ${graphics.currentTyreSet} (Seco)`;
        } else if (graphics.rainTyres === false) {
            return 'Neumático seco';
        }
        
        // Información del MFD
        if (graphics.mfdTyreSet !== undefined) {
            return `Set MFD ${graphics.mfdTyreSet}`;
        }
        
        return 'Compuesto desconocido';
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
                protocols: { sharedMemory: false, broadcasting: false },
                quality: { sharedMemory: 0, broadcasting: 0 },
                activeProtocol: 'none'
            },
            extendedData: null
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