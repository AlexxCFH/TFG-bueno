// Inicializar Socket.IO
const socket = io();

// Referencias a elementos del DOM - BÁSICOS
const connectionStatus = document.getElementById('connectionStatus');
const protocolValue = document.getElementById('protocolValue');
const lastUpdate = document.getElementById('lastUpdate');

// Referencias - INFORMACIÓN DEL COCHE
const carName = document.getElementById('carName');
const teamName = document.getElementById('teamName');
const raceNumber = document.getElementById('raceNumber');
const driverName = document.getElementById('driverName');
const cupCategory = document.getElementById('cupCategory');

// Referencias - VELOCIDAD Y MARCHA
const speedValue = document.getElementById('speedValue');
const speedFill = document.getElementById('speedFill');
const gearValue = document.getElementById('gearValue');

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

// Variables para efectos
let lastSpeed = 0;
let isConnectedToACC = false;
let currentData = null;

// Estado de conexión anterior
let wasAccConnected = false;
let lastCarName = '';

// Eventos de conexión Socket.IO
socket.on('connect', () => {
    console.log('✅ Conectado al servidor web');
    updateConnectionStatus(true, isConnectedToACC);
    showNotification('Conectado al servidor', 'success');
});

socket.on('disconnect', () => {
    console.log('❌ Desconectado del servidor web');
    updateConnectionStatus(false, false);
    showNotification('Desconectado del servidor', 'error');
});

socket.on('connect_error', (error) => {
    console.error('❌ Error de conexión:', error);
    updateConnectionStatus(false, false);
    showNotification('Error de conexión', 'error');
});

// Evento principal de telemetría
socket.on('telemetry_update', (data) => {
    console.log('📊 Datos recibidos:', data);
    updateTelemetry(data);
    
    // Detectar cambios importantes
    detectImportantChanges(data);
});

// Función para actualizar el estado de conexión
function updateConnectionStatus(isWebConnected, isAccConnected) {
    if (!connectionStatus) return;
    
    if (isWebConnected && isAccConnected) {
        connectionStatus.textContent = '🟢 ACC Conectado';
        connectionStatus.className = 'status-indicator status-connected';
    } else if (isWebConnected && !isAccConnected) {
        connectionStatus.textContent = '🟡 Servidor Conectado (ACC desconectado)';
        connectionStatus.className = 'status-indicator status-connecting';
    } else {
        connectionStatus.textContent = '🔴 Desconectado';
        connectionStatus.className = 'status-indicator status-disconnected';
    }
}

// Función principal para actualizar la telemetría
function updateTelemetry(data) {
    if (!data) {
        console.log('⚠️ No hay datos para actualizar');
        return;
    }
    
    // Guardar datos actuales
    currentData = data;
    
    // Verificar conexión ACC
    isConnectedToACC = data.isConnected || false;
    updateConnectionStatus(socket.connected, isConnectedToACC);
    
    // Actualizar diferentes secciones solo si hay datos válidos
    if (data.protocol === 'official_corrected' || data.protocol === 'official_only') {
        // Información del coche
        if (data.carInfo) {
            updateCarInfo(data.carInfo, data.driverInfo);
        }
        
        // Datos en tiempo real
        if (data.realtimeData) {
            updateRealtimeData(data.realtimeData);
        }
        
        // Tiempos de vuelta
        if (data.lapData) {
            updateLapData(data.lapData);
        }
        
        // Datos de sesión
        if (data.sessionData) {
            updateSessionData(data.sessionData);
        }
        
        // Datos del circuito
        if (data.trackData) {
            updateTrackData(data.trackData);
        }
        
        // Protocolo y estado
        updateProtocolAndStatus(data);
        updateTimestamp();
        
        console.log('✅ Datos actualizados correctamente');
    } else {
        console.log('⚠️ Protocolo no válido:', data.protocol);
    }
}

// === FUNCIONES DE ACTUALIZACIÓN ===

function updateCarInfo(carInfo, driverInfo) {
    if (!carInfo) return;
    
    // Nombre del coche
    if (carName) {
        if (carInfo.carModel && carInfo.carModel !== 'Desconocido') {
            carName.textContent = carInfo.carModel;
            carName.style.color = '#ff6b35';
        } else {
            carName.textContent = '🚗 Esperando datos de ACC...';
            carName.style.color = '#757575';
        }
    }
    
    // Equipo
    if (teamName) {
        teamName.textContent = carInfo.teamName || 'Sin equipo';
    }
    
    // Número de carrera
    if (raceNumber) {
        raceNumber.textContent = carInfo.raceNumber ? `#${carInfo.raceNumber}` : '#-';
    }
    
    // Piloto
    if (driverName && driverInfo) {
        if (driverInfo.firstName || driverInfo.lastName) {
            const fullName = `${driverInfo.firstName || ''} ${driverInfo.lastName || ''}`.trim();
            driverName.textContent = fullName || 'Piloto desconocido';
        } else {
            driverName.textContent = 'Sin piloto';
        }
    }
    
    // Categoría de copa
    if (cupCategory) {
        cupCategory.textContent = carInfo.cupCategory || 'Sin categoría';
    }
}

function updateRealtimeData(realtimeData) {
    if (!realtimeData) return;
    
    // VELOCIDAD
    if (speedValue && speedFill) {
        const speed = Math.round(realtimeData.speed || 0);
        speedValue.innerHTML = `${speed}<span class="metric-unit">km/h</span>`;
        
        // Actualizar barra de velocidad
        const maxSpeed = 300;
        const speedPercent = Math.min((speed / maxSpeed) * 100, 100);
        speedFill.style.width = `${speedPercent}%`;
        
        // Cambiar color según velocidad
        if (speed > 200) {
            speedFill.style.background = 'linear-gradient(90deg, #f44336, #d32f2f)';
        } else if (speed > 120) {
            speedFill.style.background = 'linear-gradient(90deg, #ffeb3b, #ff9800)';
        } else {
            speedFill.style.background = 'linear-gradient(90deg, #4CAF50, #ffeb3b, #ff6b35)';
        }
        
        lastSpeed = speed;
    }
    
    // MARCHA
    if (gearValue) {
        const gear = realtimeData.gear || 'N';
        gearValue.textContent = gear;
        
        // Color de marcha
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
    if (lapsValue) {
        lapsValue.textContent = realtimeData.laps || '0';
    }
    
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

// === FUNCIONES AUXILIARES ===

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
        0: 'Práctica',
        4: 'Clasificación',
        9: 'Superpole',
        10: 'Carrera',
        11: 'Hotlap',
        12: 'Hotstint',
        13: 'Hotlap Superpole',
        14: 'Replay'
    };
    
    return types[sessionType] || `Sesión ${sessionType}`;
}

function getSessionPhaseName(phase) {
    const phases = {
        0: 'Ninguna',
        1: 'Iniciando',
        2: 'Pre-Formación',
        3: 'Vuelta de Formación',
        4: 'Pre-Sesión',
        5: 'En Sesión',
        6: 'Sesión Terminada',
        7: 'Post-Sesión',
        8: 'Pantalla de Resultados'
    };
    
    return phases[phase] || `Fase ${phase}`;
}

function updateProtocolAndStatus(data) {
    if (!protocolValue) return;
    
    const protocol = data.protocol || '-';
    let protocolText = '';
    
    switch (protocol) {
        case 'official_corrected':
            protocolText = 'Oficial Corregido';
            protocolValue.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
            break;
        case 'official_only':
            protocolText = 'Solo Oficial';
            protocolValue.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
            break;
        default:
            protocolText = 'Desconocido';
            protocolValue.style.background = 'linear-gradient(45deg, #f44336, #d32f2f)';
    }
    
    protocolValue.textContent = protocolText;
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
        showNotification('¡ACC Conectado!', 'success');
        wasAccConnected = true;
    } else if (!data.isConnected && wasAccConnected) {
        showNotification('ACC Desconectado', 'warning');
        wasAccConnected = false;
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
    }, 3000);
}

// Función para obtener datos iniciales
async function fetchInitialData() {
    try {
        const response = await fetch('/api/telemetry');
        if (response.ok) {
            const data = await response.json();
            console.log('📊 Datos iniciales cargados:', data);
            updateTelemetry(data);
        } else {
            console.error('❌ Error HTTP cargando datos iniciales:', response.status);
        }
    } catch (error) {
        console.error('❌ Error cargando datos iniciales:', error);
    }
}

// Función para verificar estado
async function checkStatus() {
    try {
        const response = await fetch('/api/status');
        if (response.ok) {
            const status = await response.json();
            console.log('📊 Estado del servidor:', status);
            
            if (!status.libraryAvailable) {
                showNotification('Librería acc-broadcast no disponible', 'error');
            } else if (!status.isRunning) {
                showNotification('Monitor no iniciado', 'warning');
            }
        }
    } catch (error) {
        console.error('❌ Error verificando estado:', error);
    }
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard oficial inicializado');
    
    // Verificar estado del servidor
    checkStatus();
    
    // Obtener datos iniciales
    fetchInitialData();
    
    // Actualizar datos periódicamente si no hay conexión WebSocket
    setInterval(() => {
        if (!socket.connected) {
            console.log('🔄 Reconectando y obteniendo datos...');
            fetchInitialData();
        }
    }, 5000);
    
    // Mostrar información inicial
    setTimeout(() => {
        if (!isConnectedToACC) {
            showNotification('Esperando conexión con ACC...', 'info');
        }
    }, 2000);
    
    console.log('✅ Dashboard listo para protocolo oficial de ACC');
});