// script.js - FRONTEND PARA SISTEMA HÍBRIDO INTELIGENTE
// Inicializar Socket.IO
const socket = io();

// Referencias a elementos del DOM - BÁSICOS
const connectionStatus = document.getElementById('connectionStatus');
const protocolValue = document.getElementById('protocolValue');
const lastUpdate = document.getElementById('lastUpdate');
const systemBadge = document.getElementById('systemBadge');

// Referencias - INFORMACIÓN DEL COCHE
const carName = document.getElementById('carName');
const teamName = document.getElementById('teamName');
const raceNumber = document.getElementById('raceNumber');
const driverName = document.getElementById('driverName');
const cupCategory = document.getElementById('cupCategory');

// Referencias - VELOCIDAD Y MARCHA
const speedValue = document.getElementById('speedValue');
const speedFill = document.getElementById('speedFill');
const speed3dValue = document.getElementById('speed3dValue');
const gearValue = document.getElementById('gearValue');

// Referencias - MOTOR Y RPM
const rpmValue = document.getElementById('rpmValue');
const rpmMax = document.getElementById('rpmMax');
const rpmNeedle = document.getElementById('rpmNeedle');
const engineTemp = document.getElementById('engineTemp');
const turboBoost = document.getElementById('turboBoost');
const fuelValue = document.getElementById('fuelValue');
const maxPower = document.getElementById('maxPower');

// Referencias - CONTROLES
const throttleFill = document.getElementById('throttleFill');
const throttleValue = document.getElementById('throttleValue');
const brakeFill = document.getElementById('brakeFill');
const brakeValue = document.getElementById('brakeValue');
const clutchFill = document.getElementById('clutchFill');
const clutchValue = document.getElementById('clutchValue');
const steerFill = document.getElementById('steerFill');
const steerValue = document.getElementById('steerValue');

// Referencias - FUERZAS G
const gForceLong = document.getElementById('gForceLong');
const gForceLat = document.getElementById('gForceLat');
const gForceVert = document.getElementById('gForceVert');

// Referencias - NEUMÁTICOS
const tyreCompound = document.getElementById('tyreCompound');
const tyreTempFL = document.getElementById('tyreTempFL');
const tyreTempFR = document.getElementById('tyreTempFR');
const tyreTempRL = document.getElementById('tyreTempRL');
const tyreTempRR = document.getElementById('tyreTempRR');
const tyrePressFL = document.getElementById('tyrePressFL');
const tyrePressRF = document.getElementById('tyrePressRF');
const tyrePressRL = document.getElementById('tyrePressRL');
const tyrePressRR = document.getElementById('tyrePressRR');

// Referencias - FRENOS
const brakeTempFL = document.getElementById('brakeTempFL');
const brakeTempFR = document.getElementById('brakeTempFR');
const brakeTempRL = document.getElementById('brakeTempRL');
const brakeTempRR = document.getElementById('brakeTempRR');
const brakeBias = document.getElementById('brakeBias');

// Referencias - SUSPENSIÓN
const rideHeightFront = document.getElementById('rideHeightFront');
const rideHeightRear = document.getElementById('rideHeightRear');
const suspTravelFL = document.getElementById('suspTravelFL');
const suspTravelFR = document.getElementById('suspTravelFR');
const suspTravelRL = document.getElementById('suspTravelRL');
const suspTravelRR = document.getElementById('suspTravelRR');

// Referencias - ASISTENCIAS
const absLevel = document.getElementById('absLevel');
const absActive = document.getElementById('absActive');
const tcLevel = document.getElementById('tcLevel');
const tcActive = document.getElementById('tcActive');
const autoShifter = document.getElementById('autoShifter');
const pitLimiter = document.getElementById('pitLimiter');

// Referencias - SISTEMAS ENERGÉTICOS
const energyCard = document.getElementById('energyCard');
const ersItem = document.getElementById('ersItem');
const kersItem = document.getElementById('kersItem');
const drsItem = document.getElementById('drsItem');
const ersStatus = document.getElementById('ersStatus');
const ersRecovery = document.getElementById('ersRecovery');
const ersPower = document.getElementById('ersPower');
const kersCharge = document.getElementById('kersCharge');
const kersInput = document.getElementById('kersInput');
const drsStatus = document.getElementById('drsStatus');

// Referencias - INFORMACIÓN DE CARRERA
const positionValue = document.getElementById('positionValue');
const lapsValue = document.getElementById('lapsValue');
const deltaValue = document.getElementById('deltaValue');
const locationValue = document.getElementById('locationValue');

// Referencias - TIEMPOS DE VUELTA
const bestLapValue = document.getElementById('bestLapValue');
const lastLapValue = document.getElementById('lastLapValue');
const currentLapValue = document.getElementById('currentLapValue');
const sector1Value = document.getElementById('sector1Value');
const sector2Value = document.getElementById('sector2Value');
const sector3Value = document.getElementById('sector3Value');

// Referencias - DATOS DE SESIÓN
const sessionTypeValue = document.getElementById('sessionTypeValue');
const sessionPhaseValue = document.getElementById('sessionPhaseValue');
const trackTempValue = document.getElementById('trackTempValue');
const ambientTempValue = document.getElementById('ambientTempValue');
const rainLevelValue = document.getElementById('rainLevelValue');
const wetnessValue = document.getElementById('wetnessValue');

// Referencias - DATOS DEL CIRCUITO
const trackNameValue = document.getElementById('trackNameValue');
const trackLengthValue = document.getElementById('trackLengthValue');

// Variables para el sistema híbrido
let currentData = null;
let isConnectedToACC = false;
let hybridStatus = {
    protocols: { sharedMemory: false, broadcasting: false },
    quality: { sharedMemory: 0, broadcasting: 0 },
    activeProtocol: 'none'
};

// Estado de conexión anterior
let wasAccConnected = false;
let lastCarName = '';

// === EVENTOS SOCKET.IO ===
socket.on('connect', () => {
    console.log('✅ Conectado al servidor híbrido');
    updateConnectionStatus(true, isConnectedToACC);
    showNotification('Conectado al sistema híbrido', 'success');
});

socket.on('disconnect', () => {
    console.log('❌ Desconectado del servidor híbrido');
    updateConnectionStatus(false, false);
    showNotification('Desconectado del servidor', 'error');
});

socket.on('connect_error', (error) => {
    console.error('❌ Error de conexión:', error);
    updateConnectionStatus(false, false);
    showNotification('Error de conexión', 'error');
});

// Evento principal de telemetría híbrida
socket.on('telemetry_update', (data) => {
    console.log('🎯 Datos híbridos recibidos:', data);
    updateHybridTelemetry(data);
    detectImportantChanges(data);
});

// === FUNCIÓN PRINCIPAL DE ACTUALIZACIÓN HÍBRIDA ===
function updateHybridTelemetry(data) {
    if (!data) {
        console.log('⚠️ No hay datos para actualizar');
        return;
    }

    currentData = data;
    isConnectedToACC = data.isConnected || false;

    // Actualizar estado híbrido
    if (data.hybridStatus) {
        hybridStatus = data.hybridStatus;
    }

    updateConnectionStatus(socket.connected, isConnectedToACC);
    updateProtocolStatus(data);

    // === ACTUALIZAR DATOS POR CATEGORÍAS ===

    // 1. Información del coche (Broadcasting priority)
    if (data.carInfo) updateCarInfo(data.carInfo, data.driverInfo);

    // 2. Datos en tiempo real (Smart merge)
    if (data.realtimeData) updateRealtimeData(data.realtimeData);

    // 3. Motor (Shared Memory priority)
    if (data.engineData) updateEngineData(data.engineData);

    // 4. Controles (Shared Memory only)
    if (data.controlsData) {
        updateControlsData(data.controlsData);
    } else {
        hideControlsData();
    }

    // 5. Fuerzas G (Shared Memory only)
    if (data.gForceData) {
        updateGForceData(data.gForceData);
    } else {
        hideGForceData();
    }

    // 6. Neumáticos (Shared Memory priority)
    if (data.tyreData) {
        updateTyreData(data.tyreData);
    } else {
        hideTyreData();
    }

    // 7. Frenos (Shared Memory priority)
    if (data.brakeData) {
        updateBrakeData(data.brakeData);
    } else {
        hideBrakeData();
    }

    // 8. Suspensión (Shared Memory only)
    if (data.suspensionData) {
        updateSuspensionData(data.suspensionData);
    } else {
        hideSuspensionData();
    }

    // 9. Asistencias (Shared Memory priority)
    if (data.aidsData) {
        updateAidsData(data.aidsData);
    } else {
        hideAidsData();
    }

    // 10. Sistemas energéticos (Shared Memory only)
    if (data.energyData) {
        updateEnergyData(data.energyData);
    } else {
        hideEnergyData();
    }

    // 11. Tiempos de vuelta (Broadcasting priority)
    if (data.lapData) updateLapData(data.lapData);

    // 12. Datos de sesión (Broadcasting priority)
    if (data.sessionData) updateSessionData(data.sessionData);

    // 13. Datos del circuito (Broadcasting priority)
    if (data.trackData) updateTrackData(data.trackData);

    updateTimestamp();
    console.log(`✅ Datos híbridos actualizados (${data.protocol})`);
}

// === FUNCIONES DE ACTUALIZACIÓN ESPECÍFICAS ===

function updateCarInfo(carInfo, driverInfo) {
    if (!carInfo) return;

    if (carName) {
        if (carInfo.carModel && carInfo.carModel !== 'Desconocido') {
            carName.textContent = carInfo.carModel;
            carName.style.color = '#ff6b35';
        } else {
            carName.textContent = '🚗 Esperando datos de ACC...';
            carName.style.color = '#757575';
        }
    }

    if (teamName) teamName.textContent = carInfo.teamName || 'Sin equipo';
    if (raceNumber) raceNumber.textContent = carInfo.raceNumber ? `#${carInfo.raceNumber}` : '#-';

    if (driverName && driverInfo) {
        if (driverInfo.firstName || driverInfo.lastName) {
            const fullName = `${driverInfo.firstName || ''} ${driverInfo.lastName || ''}`.trim();
            driverName.textContent = fullName || 'Piloto desconocido';
        } else {
            driverName.textContent = 'Sin piloto';
        }
    }

    if (cupCategory) cupCategory.textContent = carInfo.cupCategory || 'Sin categoría';
}

function updateRealtimeData(realtimeData) {
    if (!realtimeData) return;

    // VELOCIDAD
    if (speedValue && speedFill) {
        const speed = Math.round(realtimeData.speed || 0);
        speedValue.innerHTML = `${speed}<span class="metric-unit">km/h</span>`;

        const maxSpeed = 300;
        const speedPercent = Math.min((speed / maxSpeed) * 100, 100);
        speedFill.style.width = `${speedPercent}%`;

        if (speed > 200) {
            speedFill.style.background = 'linear-gradient(90deg, #f44336, #d32f2f)';
        } else if (speed > 120) {
            speedFill.style.background = 'linear-gradient(90deg, #ffeb3b, #ff9800)';
        } else {
            speedFill.style.background = 'linear-gradient(90deg, #4CAF50, #ffeb3b, #ff6b35)';
        }
    }

    // Velocidad 3D
    if (speed3dValue && realtimeData.velocity) {
        const velocity3d = Math.sqrt(
            Math.pow(realtimeData.velocity[0] || 0, 2) +
            Math.pow(realtimeData.velocity[1] || 0, 2) +
            Math.pow(realtimeData.velocity[2] || 0, 2)
        ) * 3.6;
        speed3dValue.textContent = `${Math.round(velocity3d)} km/h`;
    }

    // MARCHA
    if (gearValue) {
        const gear = realtimeData.gear || 'N';
        gearValue.textContent = gear;

        if (gear === 'R') {
            gearValue.style.color = '#9c27b0';
        } else if (gear === 'N') {
            gearValue.style.color = '#757575';
        } else if (realtimeData.speed > 150) {
            gearValue.style.color = '#f44336';
        } else if (realtimeData.speed > 80) {
            gearValue.style.color = '#ffeb3b';
        } else {
            gearValue.style.color = '#4CAF50';
        }
    }

    // POSICIÓN
    if (positionValue) {
        positionValue.textContent = realtimeData.position || '-';
        if (realtimeData.position && realtimeData.position <= 3) {
            positionValue.style.color = '#FFD700';
        } else {
            positionValue.style.color = '#ff6b35';
        }
    }

    // VUELTAS
    if (lapsValue) lapsValue.textContent = realtimeData.laps || '0';

    // DELTA
    if (deltaValue) {
        if (realtimeData.delta && realtimeData.delta !== 0) {
            const deltaSeconds = (realtimeData.delta / 1000).toFixed(3);
            const deltaFormatted = realtimeData.delta > 0 ? `+${deltaSeconds}s` : `${deltaSeconds}s`;
            deltaValue.textContent = deltaFormatted;
            deltaValue.style.color = realtimeData.delta > 0 ? '#f44336' : '#4CAF50';
        } else {
            deltaValue.textContent = '-';
            deltaValue.style.color = '#ff6b35';
        }
    }

    // UBICACIÓN
    if (locationValue) {
        updateLocationDisplay(realtimeData.carLocation);
    }
}

function updateEngineData(engineData) {
    if (!engineData) return;

    // RPM
    if (rpmValue && rpmMax && rpmNeedle) {
        const rpm = engineData.rpm || 0;
        const maxRpm = engineData.maxRpm || 8000;

        rpmValue.textContent = rpm.toLocaleString();
        rpmMax.textContent = `/ ${maxRpm.toLocaleString()}`;

        const rpmPercent = Math.min((rpm / maxRpm), 1);
        const angle = rpmPercent * 270;
        rpmNeedle.style.transform = `rotate(${angle}deg)`;

        if (rpmPercent > 0.9) {
            rpmNeedle.style.background = '#f44336';
        } else if (rpmPercent > 0.8) {
            rpmNeedle.style.background = '#ffeb3b';
        } else {
            rpmNeedle.style.background = '#ff6b35';
        }
    }

    // Temperatura del motor
    if (engineTemp) {
        const temp = engineData.engineTemp || 0;
        engineTemp.textContent = `${Math.round(temp)}°C`;

        if (temp > 110) {
            engineTemp.style.color = '#f44336';
        } else if (temp > 100) {
            engineTemp.style.color = '#ff9800';
        } else {
            engineTemp.style.color = '#4CAF50';
        }
    }

    // Turbo
    if (turboBoost) {
        const boost = engineData.turboBoost || 0;
        turboBoost.textContent = `${boost.toFixed(2)}`;
    }

    // Combustible
    if (fuelValue) {
        const fuel = engineData.fuel || 0;
        const maxFuel = engineData.maxFuel || 100;
        fuelValue.textContent = `${fuel.toFixed(1)}L / ${maxFuel}L`;

        const fuelPercent = fuel / maxFuel;
        if (fuelPercent < 0.1) {
            fuelValue.style.color = '#f44336';
        } else if (fuelPercent < 0.25) {
            fuelValue.style.color = '#ff9800';
        } else {
            fuelValue.style.color = '#ffeb3b';
        }
    }

    // Potencia máxima
    if (maxPower) {
        const power = engineData.maxPower || 0;
        maxPower.textContent = `${power}cv`;
    }
}

function updateControlsData(controlsData) {
    if (!controlsData) return;

    // Acelerador
    if (throttleFill && throttleValue) {
        const throttle = (controlsData.throttle || 0) * 100;
        throttleFill.style.width = `${throttle}%`;
        throttleValue.textContent = `${Math.round(throttle)}%`;
    }

    // Freno
    if (brakeFill && brakeValue) {
        const brake = (controlsData.brake || 0) * 100;
        brakeFill.style.width = `${brake}%`;
        brakeValue.textContent = `${Math.round(brake)}%`;
    }

    // Embrague
    if (clutchFill && clutchValue) {
        const clutch = (controlsData.clutch || 0) * 100;
        clutchFill.style.width = `${clutch}%`;
        clutchValue.textContent = `${Math.round(clutch)}%`;
    }

    // Volante
    if (steerFill && steerValue) {
        const steer = controlsData.steerAngle || 0;
        steerValue.textContent = `${Math.round(steer)}°`;

        const steerPercent = Math.abs(steer) / 540;
        const fillWidth = Math.min(steerPercent * 50, 50);

        if (steer > 0) {
            steerFill.style.marginLeft = '50%';
            steerFill.style.width = `${fillWidth}%`;
        } else {
            steerFill.style.marginLeft = `${50 - fillWidth}%`;
            steerFill.style.width = `${fillWidth}%`;
        }
    }
}

function updateGForceData(gForceData) {
    if (!gForceData) return;

    if (gForceLong) {
        const gLong = gForceData.longitudinal || 0;
        gForceLong.textContent = `${gLong.toFixed(2)}G`;
        gForceLong.style.color = Math.abs(gLong) > 1.5 ? '#f44336' : '#ff6b35';
    }

    if (gForceLat) {
        const gLat = gForceData.lateral || 0;
        gForceLat.textContent = `${gLat.toFixed(2)}G`;
        gForceLat.style.color = Math.abs(gLat) > 1.2 ? '#f44336' : '#ff6b35';
    }

    if (gForceVert) {
        const gVert = gForceData.vertical || 0;
        gForceVert.textContent = `${gVert.toFixed(2)}G`;
        gForceVert.style.color = Math.abs(gVert) > 2.0 ? '#f44336' : '#ff6b35';
    }
}

function updateTyreData(tyreData) {
    if (!tyreData) return;

    // Compuesto
    if (tyreCompound) {
        tyreCompound.textContent = tyreData.compound || 'Desconocido';
    }

    // Temperaturas
    if (tyreData.temperatures) {
        const temps = tyreData.temperatures;
        if (tyreTempFL) tyreTempFL.textContent = `${Math.round(temps[0] || 0)}°C`;
        if (tyreTempFR) tyreTempFR.textContent = `${Math.round(temps[1] || 0)}°C`;
        if (tyreTempRL) tyreTempRL.textContent = `${Math.round(temps[2] || 0)}°C`;
        if (tyreTempRR) tyreTempRR.textContent = `${Math.round(temps[3] || 0)}°C`;

        [tyreTempFL, tyreTempFR, tyreTempRL, tyreTempRR].forEach((element, index) => {
            if (element) {
                const temp = temps[index] || 0;
                if (temp > 110) {
                    element.style.color = '#f44336';
                } else if (temp > 90) {
                    element.style.color = '#ff9800';
                } else if (temp > 70) {
                    element.style.color = '#4CAF50';
                } else {
                    element.style.color = '#2196F3';
                }
            }
        });
    }

    // Presiones
    if (tyreData.pressures) {
        const pressures = tyreData.pressures;
        if (tyrePressFL) tyrePressFL.textContent = `${(pressures[0] || 0).toFixed(1)} psi`;
        if (tyrePressRF) tyrePressRF.textContent = `${(pressures[1] || 0).toFixed(1)} psi`;
        if (tyrePressRL) tyrePressRL.textContent = `${(pressures[2] || 0).toFixed(1)} psi`;
        if (tyrePressRR) tyrePressRR.textContent = `${(pressures[3] || 0).toFixed(1)} psi`;
    }
}

function updateBrakeData(brakeData) {
    if (!brakeData || !brakeData.temperatures) return;

    const brakeTemps = brakeData.temperatures;
    if (brakeTempFL) brakeTempFL.textContent = `${Math.round(brakeTemps[0] || 0)}°C`;
    if (brakeTempFR) brakeTempFR.textContent = `${Math.round(brakeTemps[1] || 0)}°C`;
    if (brakeTempRL) brakeTempRL.textContent = `${Math.round(brakeTemps[2] || 0)}°C`;
    if (brakeTempRR) brakeTempRR.textContent = `${Math.round(brakeTemps[3] || 0)}°C`;

    [brakeTempFL, brakeTempFR, brakeTempRL, brakeTempRR].forEach((element, index) => {
        if (element) {
            const temp = brakeTemps[index] || 0;
            if (temp > 600) {
                element.style.color = '#f44336';
            } else if (temp > 400) {
                element.style.color = '#ff9800';
            } else if (temp > 200) {
                element.style.color = '#ffeb3b';
            } else {
                element.style.color = '#4CAF50';
            }
        }
    });

    if (brakeBias && brakeData.bias !== undefined) {
        const bias = (brakeData.bias || 0.5) * 100;
        brakeBias.textContent = `${bias.toFixed(1)}%`;
    }
}

function updateSuspensionData(suspensionData) {
    if (!suspensionData) return;

    if (suspensionData.rideHeight) {
        if (rideHeightFront) rideHeightFront.textContent = `${(suspensionData.rideHeight[0] || 0).toFixed(1)}mm`;
        if (rideHeightRear) rideHeightRear.textContent = `${(suspensionData.rideHeight[1] || 0).toFixed(1)}mm`;
    }

    if (suspensionData.travel) {
        const travel = suspensionData.travel;
        if (suspTravelFL) suspTravelFL.textContent = `${(travel[0] || 0).toFixed(1)}mm`;
        if (suspTravelFR) suspTravelFR.textContent = `${(travel[1] || 0).toFixed(1)}mm`;
        if (suspTravelRL) suspTravelRL.textContent = `${(travel[2] || 0).toFixed(1)}mm`;
        if (suspTravelRR) suspTravelRR.textContent = `${(travel[3] || 0).toFixed(1)}mm`;
    }
}

function updateAidsData(aidsData) {
    if (!aidsData) return;

    if (absLevel && aidsData.abs) {
        const abs = aidsData.abs.level || 0;
        absLevel.textContent = abs > 0 ? `Nivel ${abs}` : 'OFF';
        absLevel.style.color = abs > 0 ? '#4CAF50' : '#757575';
    }

    if (absActive && aidsData.abs) {
        const active = aidsData.abs.active || 0;
        absActive.textContent = active ? '●' : '○';
        absActive.style.color = active ? '#f44336' : '#757575';
    }

    if (tcLevel && aidsData.tc) {
        const tc = aidsData.tc.level || 0;
        tcLevel.textContent = tc > 0 ? `Nivel ${tc}` : 'OFF';
        tcLevel.style.color = tc > 0 ? '#4CAF50' : '#757575';
    }

    if (tcActive && aidsData.tc) {
        const active = aidsData.tc.active || 0;
        tcActive.textContent = active ? '●' : '○';
        tcActive.style.color = active ? '#f44336' : '#757575';
    }

    if (autoShifter) {
        const auto = aidsData.autoShifter || 0;
        autoShifter.textContent = auto ? 'ON' : 'OFF';
        autoShifter.style.color = auto ? '#4CAF50' : '#757575';
    }

    if (pitLimiter) {
        const limiter = aidsData.pitLimiter || 0;
        pitLimiter.textContent = limiter ? 'ON' : 'OFF';
        pitLimiter.style.color = limiter ? '#ffeb3b' : '#757575';
    }
}

function updateEnergyData(energyData) {
    if (!energyData) return;

    let hasAnySystem = false;

    if (energyData.hasERS) {
        hasAnySystem = true;
        if (ersItem) ersItem.style.display = 'block';

        if (ersStatus && energyData.ers) {
            ersStatus.textContent = energyData.ers.isCharging ? 'Cargando' : 'Disponible';
            ersStatus.style.color = energyData.ers.isCharging ? '#ffeb3b' : '#4CAF50';
        }

        if (ersRecovery && energyData.ers) ersRecovery.textContent = `Nivel ${energyData.ers.recoveryLevel || 0}`;
        if (ersPower && energyData.ers) ersPower.textContent = `Nivel ${energyData.ers.powerLevel || 0}`;
    }

    if (energyData.hasKERS) {
        hasAnySystem = true;
        if (kersItem) kersItem.style.display = 'block';

        if (kersCharge && energyData.kers) {
            const current = energyData.kers.currentKJ || 0;
            const max = energyData.kers.maxKJ || 0;
            kersCharge.textContent = `${current.toFixed(1)}/${max.toFixed(1)} kJ`;
        }

        if (kersInput && energyData.kers) {
            const input = (energyData.kers.input || 0) * 100;
            kersInput.textContent = `${input.toFixed(1)}%`;
        }
    }

    if (energyData.hasDRS) {
        hasAnySystem = true;
        if (drsItem) drsItem.style.display = 'block';

        if (drsStatus && energyData.drs) {
            const drs = energyData.drs.active || 0;
            drsStatus.textContent = drs ? 'ACTIVADO' : 'Disponible';
            drsStatus.style.color = drs ? '#4CAF50' : '#757575';
        }
    }

    if (energyCard) {
        energyCard.style.display = hasAnySystem ? 'block' : 'none';
    }
}

function updateLapData(lapData) {
    if (!lapData) return;

    // Mejor vuelta de sesión
    if (bestLapValue) {
        if (lapData.bestSessionLap && lapData.bestSessionLap.laptimeMS) {
            bestLapValue.textContent = formatTime(lapData.bestSessionLap.laptimeMS);
            bestLapValue.style.color = lapData.bestSessionLap.isInvalid ? '#f44336' : '#4CAF50';
        } else {
            bestLapValue.textContent = '--:--.---';
            bestLapValue.style.color = '#757575';
        }
    }

    // Última vuelta
    if (lastLapValue) {
        if (lapData.lastLap && lapData.lastLap.laptimeMS) {
            lastLapValue.textContent = formatTime(lapData.lastLap.laptimeMS);
            lastLapValue.style.color = lapData.lastLap.isInvalid ? '#f44336' : '#ffeb3b';
        } else {
            lastLapValue.textContent = '--:--.---';
            lastLapValue.style.color = '#757575';
        }
    }

    // Vuelta actual
    if (currentLapValue) {
        if (lapData.currentLap && lapData.currentLap.laptimeMS) {
            currentLapValue.textContent = formatTime(lapData.currentLap.laptimeMS);
        } else {
            currentLapValue.textContent = '--:--.---';
        }
    }

    // Sectores
    const bestLapSplits = lapData.bestSessionLap?.splits || [null, null, null];
    updateSectorTimes(bestLapSplits);
}

function updateSessionData(sessionData) {
    if (!sessionData) return;

    // Tipo de sesión
    if (sessionTypeValue) {
        sessionTypeValue.textContent = getSessionTypeName(sessionData.sessionType);
    }

    // Fase de sesión
    if (sessionPhaseValue) {
        sessionPhaseValue.textContent = getSessionPhaseName(sessionData.phase);
    }

    // Temperaturas
    if (trackTempValue) {
        trackTempValue.textContent = `${sessionData.trackTemp || 0}°C`;
    }
    if (ambientTempValue) {
        ambientTempValue.textContent = `${sessionData.ambientTemp || 0}°C`;
    }

    // Condiciones climáticas
    if (rainLevelValue) {
        if (sessionData.rainLevel > 0) {
            rainLevelValue.textContent = `${Math.round(sessionData.rainLevel * 100)}%`;
            rainLevelValue.parentElement.style.display = 'block';
        } else {
            rainLevelValue.parentElement.style.display = 'none';
        }
    }

    if (wetnessValue) {
        if (sessionData.wetness > 0) {
            wetnessValue.textContent = `${Math.round(sessionData.wetness * 100)}%`;
            wetnessValue.parentElement.style.display = 'block';
        } else {
            wetnessValue.parentElement.style.display = 'none';
        }
    }
}

function updateTrackData(trackData) {
    if (!trackData) return;

    if (trackNameValue && trackData.trackName) {
        trackNameValue.textContent = trackData.trackName;
    }

    if (trackLengthValue && trackData.trackMeters) {
        trackLengthValue.textContent = `${trackData.trackMeters}m`;
    }
}

// === FUNCIONES PARA OCULTAR DATOS NO DISPONIBLES ===

function hideControlsData() {
    [throttleFill, brakeFill, clutchFill, steerFill].forEach(element => {
        if (element) element.style.width = '0%';
    });
    [throttleValue, brakeValue, clutchValue, steerValue].forEach(element => {
        if (element) element.textContent = '-%';
    });
}

function hideGForceData() {
    [gForceLong, gForceLat, gForceVert].forEach(element => {
        if (element) element.textContent = '-.--G';
    });
}

function hideTyreData() {
    if (tyreCompound) tyreCompound.textContent = 'No disponible';
    [tyreTempFL, tyreTempFR, tyreTempRL, tyreTempRR].forEach(element => {
        if (element) element.textContent = '-°C';
    });
    [tyrePressFL, tyrePressRF, tyrePressRL, tyrePressRR].forEach(element => {
        if (element) element.textContent = '-.- psi';
    });
}

function hideBrakeData() {
    [brakeTempFL, brakeTempFR, brakeTempRL, brakeTempRR].forEach(element => {
        if (element) element.textContent = '-°C';
    });
    if (brakeBias) brakeBias.textContent = '-.-%';
}

function hideSuspensionData() {
    [rideHeightFront, rideHeightRear].forEach(element => {
        if (element) element.textContent = '-mm';
    });
    [suspTravelFL, suspTravelFR, suspTravelRL, suspTravelRR].forEach(element => {
        if (element) element.textContent = '-mm';
    });
}

function hideAidsData() {
    [absLevel, tcLevel].forEach(element => {
        if (element) {
            element.textContent = 'No disponible';
            element.style.color = '#757575';
        }
    });
    [absActive, tcActive].forEach(element => {
        if (element) {
            element.textContent = '○';
            element.style.color = '#757575';
        }
    });
    [autoShifter, pitLimiter].forEach(element => {
        if (element) {
            element.textContent = 'No disponible';
            element.style.color = '#757575';
        }
    });
}

function hideEnergyData() {
    if (energyCard) energyCard.style.display = 'none';
    if (ersItem) ersItem.style.display = 'none';
    if (kersItem) kersItem.style.display = 'none';
    if (drsItem) drsItem.style.display = 'none';
}

// === FUNCIONES AUXILIARES ===

function updateConnectionStatus(isWebConnected, isAccConnected) {
    if (!connectionStatus) return;

    if (isWebConnected && isAccConnected) {
        connectionStatus.textContent = '🟢 Sistema Híbrido Conectado';
        connectionStatus.className = 'status-indicator status-connected';
    } else if (isWebConnected && !isAccConnected) {
        connectionStatus.textContent = '🟡 Servidor Conectado (ACC desconectado)';
        connectionStatus.className = 'status-indicator status-connecting';
    } else {
        connectionStatus.textContent = '🔴 Desconectado';
        connectionStatus.className = 'status-indicator status-disconnected';
    }
}

function updateProtocolStatus(data) {
    if (!protocolValue) return;

    const protocol = data.protocol || 'none';
    let protocolText = '';
    let badgeText = '';

    switch (protocol) {
        case 'hybrid':
            protocolText = 'Híbrido Inteligente';
            protocolValue.style.background = 'linear-gradient(45deg, #9c27b0, #4CAF50)';
            badgeText = `Sistema Híbrido - SM: ${hybridStatus.protocols?.sharedMemory ? 'ON' : 'OFF'} | BC: ${hybridStatus.protocols?.broadcasting ? 'ON' : 'OFF'}`;
            break;
        case 'shared_memory':
            protocolText = 'Memoria Compartida';
            protocolValue.style.background = 'linear-gradient(45deg, #9c27b0, #673ab7)';
            badgeText = 'Sistema Híbrido - Solo Memoria Compartida';
            break;
        case 'broadcasting':
            protocolText = 'Broadcasting';
            protocolValue.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
            badgeText = 'Sistema Híbrido - Solo Broadcasting';
            break;
        default:
            protocolText = 'Sin Conexión';
            protocolValue.style.background = 'linear-gradient(45deg, #f44336, #d32f2f)';
            badgeText = 'Sistema Híbrido - Sin Conexión';
    }

    protocolValue.textContent = protocolText;
    if (systemBadge) systemBadge.textContent = badgeText;
}

function updateLocationDisplay(carLocation) {
    if (!locationValue) return;

    const locations = {
        0: 'Desconocido',
        1: 'Pista',
        2: 'Pit Lane',
        3: 'Entrada Pits',
        4: 'Salida Pits'
    };

    const locationName = locations[carLocation] || 'Desconocido';
    locationValue.textContent = locationName;

    // Color según ubicación
    switch (carLocation) {
        case 1: // Pista
            locationValue.style.color = '#4CAF50';
            break;
        case 2: // Pit Lane
            locationValue.style.color = '#ffeb3b';
            break;
        case 3: // Entrada Pits
        case 4: // Salida Pits
            locationValue.style.color = '#ff9800';
            break;
        default:
            locationValue.style.color = '#757575';
    }
}

function updateSectorTimes(splits) {
    const sectorElements = [sector1Value, sector2Value, sector3Value];

    splits.forEach((splitTime, index) => {
        const element = sectorElements[index];
        if (element) {
            if (splitTime && splitTime > 0) {
                element.textContent = formatTime(splitTime);
                element.style.color = '#ff6b35';
            } else {
                element.textContent = '--:--.---';
                element.style.color = '#757575';
            }
        }
    });
}

function getSessionTypeName(sessionType) {
    const types = {
        0: 'Práctica', 1: 'Clasificación', 2: 'Carrera', 3: 'Hotlap',
        4: 'Clasificación', 9: 'Superpole', 10: 'Carrera', 11: 'Hotlap',
        12: 'Hotstint', 13: 'Hotlap Superpole', 14: 'Replay'
    };
    return types[sessionType] || `Sesión ${sessionType}`;
}

function getSessionPhaseName(phase) {
    const phases = {
        0: 'Ninguna', 1: 'Iniciando', 2: 'Pre-Formación', 3: 'Vuelta de Formación',
        4: 'Pre-Sesión', 5: 'En Sesión', 6: 'Sesión Terminada', 7: 'Post-Sesión',
        8: 'Pantalla de Resultados'
    };
    return phases[phase] || `Fase ${phase}`;
}

function formatTime(milliseconds) {
    if (!milliseconds || milliseconds <= 0) return '--:--.---';

    const totalSeconds = milliseconds / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function updateTimestamp() {
    if (!lastUpdate) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES');
    lastUpdate.textContent = `Última actualización: ${timeString}`;
}

function detectImportantChanges(data) {
    if (!data) return;

    // Detectar conexión ACC
    if (data.isConnected && !wasAccConnected) {
        const protocolName = data.protocol === 'hybrid' ? 'Híbrido Inteligente' :
            data.protocol === 'shared_memory' ? 'Memoria Compartida' : 'Broadcasting';
        showNotification(`¡ACC Conectado! (${protocolName})`, 'success');
        wasAccConnected = true;
    } else if (!data.isConnected && wasAccConnected) {
        showNotification('ACC Desconectado', 'warning');
        wasAccConnected = false;
    }

    // Detectar cambio de protocolo
    if (data.protocol && data.protocol !== currentData?.protocol) {
        const protocolNames = {
            'hybrid': 'Híbrido Inteligente',
            'shared_memory': 'Memoria Compartida',
            'broadcasting': 'Broadcasting'
        };
        const protocolName = protocolNames[data.protocol] || data.protocol;
        showNotification(`Protocolo: ${protocolName}`, 'info');
    }

    // Detectar coche nuevo
    if (data.carInfo?.carModel &&
        data.carInfo.carModel !== 'Desconocido' &&
        data.carInfo.carModel !== lastCarName) {
        showNotification(`Coche: ${data.carInfo.carModel}`, 'info');
        lastCarName = data.carInfo.carModel;
    }

    // Detectar eventos importantes
    if (data.lastEvent) {
        if (data.lastEvent.type === 6) {
            showNotification(`🏆 ¡Nueva mejor vuelta!`, 'success');
        } else if (data.lastEvent.type === 7) {
            showNotification(`🎯 ¡Mejor vuelta personal!`, 'success');
        } else if (data.lastEvent.type === 4) {
            showNotification(`⚠️ Accidente detectado`, 'warning');
        }
    }

    // Detectar telemetría extrema (solo con datos detallados)
    if ((data.protocol === 'hybrid' || data.protocol === 'shared_memory') && data.engineData) {
        // Temperatura alta del motor
        if (data.engineData.engineTemp > 115) {
            showNotification('🔥 ¡Temperatura del motor alta!', 'warning');
        }

        // Combustible bajo
        if (data.engineData.fuel < 5 && data.engineData.fuel > 0) {
            showNotification('⛽ ¡Combustible bajo!', 'warning');
        }
    }

    if (data.gForceData) {
        // Fuerzas G extremas
        const maxG = Math.max(
            Math.abs(data.gForceData.lateral || 0),
            Math.abs(data.gForceData.longitudinal || 0)
        );
        if (maxG > 2.0) {
            showNotification(`💥 Fuerzas G altas: ${maxG.toFixed(1)}G`, 'warning');
        }
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 10px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    switch (type) {
        case 'success':
            notification.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
            break;
        case 'error':
            notification.style.background = 'linear-gradient(45deg, #f44336, #d32f2f)';
            break;
        case 'warning':
            notification.style.background = 'linear-gradient(45deg, #ff9800, #f57c00)';
            break;
        default:
            notification.style.background = 'linear-gradient(45deg, #2196F3, #1976D2)';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.style.opacity = '1', 100);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Función para obtener datos iniciales
async function fetchInitialData() {
    try {
        const response = await fetch('/api/telemetry');
        if (response.ok) {
            const data = await response.json();
            console.log('📊 Datos híbridos iniciales cargados:', data);
            updateHybridTelemetry(data);
        } else {
            console.error('❌ Error HTTP cargando datos iniciales:', response.status);
        }
    } catch (error) {
        console.error('❌ Error cargando datos iniciales:', error);
    }
}

// Función para verificar estado híbrido
async function checkHybridStatus() {
    try {
        const response = await fetch('/api/status');
        if (response.ok) {
            const status = await response.json();
            console.log('📊 Estado del sistema híbrido:', status);

            if (!status.libraryAvailable) {
                showNotification('Librería acc-broadcast no disponible', 'error');
            } else if (!status.isRunning) {
                showNotification('Sistema híbrido no iniciado', 'warning');
            } else {
                // Mostrar estado de protocolos híbridos
                const hybridStatus = status.hybridStatus;
                if (hybridStatus?.protocols?.sharedMemory && hybridStatus?.protocols?.broadcasting) {
                    showNotification('Sistema Híbrido: Ambos protocolos activos', 'success');
                } else if (hybridStatus?.protocols?.sharedMemory) {
                    showNotification('Sistema Híbrido: Solo Memoria Compartida', 'info');
                } else if (hybridStatus?.protocols?.broadcasting) {
                    showNotification('Sistema Híbrido: Solo Broadcasting', 'info');
                }
            }
        }
    } catch (error) {
        console.error('❌ Error verificando estado híbrido:', error);
    }
}

// Inicializar aplicación híbrida
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard Híbrido Inteligente inicializado');

    // Verificar estado del sistema híbrido
    checkHybridStatus();

    // Obtener datos iniciales
    fetchInitialData();

    // Actualizar datos periódicamente si no hay conexión WebSocket
    setInterval(() => {
        if (!socket.connected) {
            console.log('🔄 Reconectando y obteniendo datos híbridos...');
            fetchInitialData();
        }
    }, 5000);

    // Mostrar información inicial
    setTimeout(() => {
        if (!isConnectedToACC) {
            showNotification('Esperando conexión híbrida con ACC...', 'info');
        }
    }, 2000);

    console.log('✅ Dashboard Híbrido Inteligente listo');
    console.log('🔄 Anti-solapamiento de datos activado');
    console.log('🎯 Priorización automática por tipo de dato');
});