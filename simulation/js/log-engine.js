/**
 * ============================================
 * LOG ENGINE
 * ============================================
 * Manages all logging for Network Functions
 * 
 * Responsibilities:
 * - Generate logs for NF lifecycle events
 * - Check dependencies and show errors/warnings
 * - Simulate 5G network behavior
 * - Store and manage log entries
 * - Notify UI of new logs
 */

class LogEngine {
    constructor() {
        this.logs = new Map();
        this.maxLogsPerNF = 100;
        this.logListeners = [];
        this.dependencies = null;
        this.logScenarios = null; // Custom log scenarios

        this.init();
    }

    async init() {
        console.log('📋 LogEngine: Initializing...');

        // Load dependencies
        try {
            const response = await fetch('../nf-dependencies.json');
            this.dependencies = await response.json();
            console.log('✅ Dependencies loaded');
        } catch (error) {
            console.warn('⚠️ Could not load dependencies');
            this.dependencies = this.getDefaultDependencies();
        }

        // Load custom log scenarios from 5g-logs.json
        try {
            const response = await fetch('../5g-logs.json');
            const logsData = await response.json();
            
            // Convert 5g-logs.json export format to scenario format
            if (logsData.logs && Array.isArray(logsData.logs)) {
                this.logScenarios = this.convertLogsToScenarios(logsData.logs);
                console.log('✅ Log scenarios loaded from 5g-logs.json');
            } else {
                // Fallback to log-scenarios.json if 5g-logs.json format is unexpected
                throw new Error('Unexpected format');
            }
        } catch (error) {
            console.warn('⚠️ Could not load 5g-logs.json, trying log-scenarios.json...');
            try {
                const response = await fetch('../log-scenarios.json');
                this.logScenarios = await response.json();
                console.log('✅ Log scenarios loaded from log-scenarios.json');
            } catch (fallbackError) {
                console.warn('⚠️ Could not load log scenarios, using basic logs');
                this.logScenarios = null;
            }
        }
    }

    getDefaultDependencies() {
        return {
            'NRF': { required: [], optional: [] },
            'AMF': { required: ['NRF'], optional: ['AUSF', 'UDM'] },
            'SMF': { required: ['NRF'], optional: ['UPF', 'PCF'] },
            'UPF': { required: ['NRF'], optional: [] },
            'AUSF': { required: ['NRF', 'UDM'], optional: [] },
            'UDM': { required: ['NRF'], optional: ['MySQL'] },
            'PCF': { required: ['NRF'], optional: [] },
            'NSSF': { required: ['NRF'], optional: [] },
            'UDR': { required: ['NRF'], optional: [] },
            'gNB': { required: ['AMF', 'UPF'], optional: [] },
            'UE': { required: ['gNB'], optional: [] },
            'MySQL': { required: [], optional: ['UDM'] }
        };
    }

    addLog(nfId, level, message, details = {}) {
        // Replace {instance} and {random} placeholders
        const nf = window.dataStore?.getNFById(nfId);
        if (nf) {
            const instance = nf.name.split('-')[1] || '1';
            const random = Math.random().toString(36).substr(2, 6);
            message = message.replace(/\{instance\}/g, instance);
            message = message.replace(/\{random\}/g, random);

            // Replace in details too
            Object.keys(details).forEach(key => {
                if (typeof details[key] === 'string') {
                    details[key] = details[key].replace(/\{random\}/g, random);
                }
            });

            // Generate dynamic endpoint if details contains a static endpoint
            if (details.endpoint && nf.config) {
                details.endpoint = this.generateDynamicEndpoint(nf);
            }
        }

        const logEntry = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            nfId: nfId,
            timestamp: Date.now(),
            level: level,
            message: message,
            details: details
        };

        if (!this.logs.has(nfId)) {
            this.logs.set(nfId, []);
        }

        const nfLogs = this.logs.get(nfId);
        nfLogs.push(logEntry);

        if (nfLogs.length > this.maxLogsPerNF) {
            nfLogs.shift();
        }

        this.notifyListeners(logEntry);

        // Console log
        const time = new Date(logEntry.timestamp).toLocaleTimeString();
        const nfName = nf?.name || nfId;

        const logStyles = {
            'ERROR': 'color: #e74c3c; font-weight: bold',
            'WARNING': 'color: #ff9800; font-weight: bold',
            'INFO': 'color: #3498db',
            'SUCCESS': 'color: #4caf50; font-weight: bold',
            'DEBUG': 'color: #95a5a6'
        };

        console.log(
            `%c[${time}] ${nfName} | ${level}%c | ${message}`,
            logStyles[level],
            'color: inherit'
        );

        return logEntry;
    }

    /**
     * Generate dynamic endpoint URL based on NF configuration
     * @param {Object} nf - Network Function object
     * @returns {string} Dynamic endpoint URL
     */
    generateDynamicEndpoint(nf) {
        if (!nf.config || !nf.config.ipAddress || !nf.config.port) {
            return 'https://192.168.1.10:8080/api/v1'; // fallback
        }

        const protocol = nf.config.httpProtocol === 'HTTP/1' ? 'http' : 'https';
        const ip = nf.config.ipAddress;
        const port = nf.config.port;

        // Generate NF-specific endpoint paths
        const endpointPaths = {
            'NRF': '/nnrf-nfm/v1',
            'AMF': '/namf-comm/v1',
            'SMF': '/nsmf-pdusession/v1',
            'UPF': '/nupf-upf/v1',
            'AUSF': '/nausf-auth/v1',
            'UDM': '/nudm-sdm/v1',
            'PCF': '/npcf-am-policy/v1',
            'NSSF': '/nnssf-nsselection/v1',
            'UDR': '/nudr-dr/v1',
            'gNB': '/gnb-mgmt/v1',
            'UE': '/ue-mgmt/v1',
            'MySQL': '' // MySQL uses different format
        };

        if (nf.type === 'MySQL') {
            return `mysql://${ip}:${port}/5g_core_db`;
        }

        const path = endpointPaths[nf.type] || '/api/v1';
        return `${protocol}://${ip}:${port}${path}`;
    }

    /**
     * Convert exported logs to scenario format
     * @param {Array} logs - Array of log entries from 5g-logs.json
     * @returns {Object} Scenario format object
     */
    convertLogsToScenarios(logs) {
        const scenarios = {};
        
        // Group logs by NF type (extract from NF ID or message)
        const logsByType = {};
        
        logs.forEach(log => {
            // Skip system logs
            if (log.nfId === 'system') return;
            
            // Try to determine NF type from the log
            // Look for patterns like "NRF-1", "AMF-1", etc. in messages or extract from NF ID
            let nfType = null;
            
            // Extract from message patterns
            const typeMatch = log.message?.match(/(NRF|AMF|SMF|UPF|AUSF|UDM|PCF|NSSF|UDR|MySQL)-?\d*/i);
            if (typeMatch) {
                nfType = typeMatch[1].toUpperCase();
            } else if (log.nfId) {
                // Extract from NF ID (format: "nrf-xxx", "amf-xxx", etc.)
                const idMatch = log.nfId.match(/^([a-z]+)-/);
                if (idMatch) {
                    const typeStr = idMatch[1].toUpperCase();
                    // Map common abbreviations
                    const typeMap = {
                        'NRF': 'NRF', 'AMF': 'AMF', 'SMF': 'SMF', 'UPF': 'UPF',
                        'AUSF': 'AUSF', 'UDM': 'UDM', 'PCF': 'PCF', 'NSSF': 'NSSF',
                        'UDR': 'UDR', 'MYSQL': 'MySQL'
                    };
                    nfType = typeMap[typeStr] || typeStr;
                }
            }
            
            if (!nfType) return;
            
            if (!logsByType[nfType]) {
                logsByType[nfType] = [];
            }
            logsByType[nfType].push(log);
        });
        
        // Convert each NF type's logs to scenario format
        Object.keys(logsByType).forEach(nfType => {
            const typeLogs = logsByType[nfType];
            
            // Sort by timestamp
            typeLogs.sort((a, b) => a.timestamp - b.timestamp);
            
            // Create startup scenario
            const startup = {};
            let delay = 0;
            
            typeLogs.forEach((log, index) => {
                // Skip connection logs and focus on startup logs
                if (log.message?.includes('Connected to') || 
                    log.message?.includes('Auto-connected')) {
                    return;
                }
                
                const stepName = `step_${index}`;
                startup[stepName] = {
                    delay: delay,
                    level: log.level || 'INFO',
                    message: log.message,
                    details: log.details || {}
                };
                
                // Increment delay for next step (simulate timing)
                delay += 300 + Math.random() * 200;
            });
            
            scenarios[nfType] = {
                startup: startup,
                dependencies: {},
                final_status: {
                    all_ok: {
                        delay: delay + 300,
                        level: 'SUCCESS',
                        message: `${nfType} is fully operational and ready`,
                        details: { status: 'OPERATIONAL', ready: true }
                    }
                }
            };
        });
        
        return scenarios;
    }

    /**
     * NF Added - Generate custom logs based on scenarios
     */
    onNFAdded(nf) {
        console.log('📋 LogEngine: NF Added:', nf.name);

        // Check if we have custom scenarios for this NF type
        if (this.logScenarios && this.logScenarios[nf.type]) {
            this.runCustomScenario(nf);
        } else {
            // Fallback to basic logs
            this.runBasicScenario(nf);
        }
    }

    /**
     * Run custom log scenario from JSON
     */
    runCustomScenario(nf) {
        const scenario = this.logScenarios[nf.type];

        // ==================================
        // STARTUP LOGS
        // ==================================
        if (scenario.startup) {
            Object.values(scenario.startup).forEach(logConfig => {
                setTimeout(() => {
                    this.addLog(nf.id, logConfig.level, logConfig.message, logConfig.details || {});
                }, logConfig.delay);
            });
        }

        // ==================================
        // DEPENDENCY CHECKS
        // ==================================
        if (scenario.dependencies) {
            Object.keys(scenario.dependencies).forEach(depType => {
                const depConfig = scenario.dependencies[depType];

                // Check if dependency exists
                const exists = this.checkNFTypeExists(depType);
                const isConnected = this.hasConnectionToType(nf, depType);

                if (!exists && depConfig.missing) {
                    // Dependency missing
                    setTimeout(() => {
                        this.addLog(nf.id, depConfig.missing.level, depConfig.missing.message, depConfig.missing.details || {});
                    }, depConfig.missing.delay);
                } else if (exists && !isConnected && depConfig.exists_not_connected) {
                    // Exists but not connected
                    setTimeout(() => {
                        this.addLog(nf.id, depConfig.exists_not_connected.level, depConfig.exists_not_connected.message, depConfig.exists_not_connected.details || {});
                    }, depConfig.exists_not_connected.delay);
                } else if (exists && isConnected) {
                    // Connected - show connection logs
                    if (depConfig.connected) {
                        setTimeout(() => {
                            // Check if connection is via bus
                            const connectionMethod = this.getConnectionMethod(nf, depType);
                            const enhancedDetails = {
                                ...depConfig.connected.details,
                                connectionMethod: connectionMethod
                            };

                            let message = depConfig.connected.message;
                            if (connectionMethod === 'bus') {
                                message = message.replace('connection established', 'connection established via Service Bus');
                            }

                            this.addLog(nf.id, depConfig.connected.level, message, enhancedDetails);
                        }, depConfig.connected.delay);
                    }

                    if (depConfig.registered) {
                        setTimeout(() => {
                            this.addLog(nf.id, depConfig.registered.level, depConfig.registered.message, depConfig.registered.details || {});
                        }, depConfig.registered.delay);
                    }
                }
            });
        }

        // ==================================
        // FINAL STATUS
        // ==================================
        if (scenario.final_status) {
            const depInfo = this.dependencies[nf.type];
            let hasErrors = false;
            let hasWarnings = false;

            // Check all required dependencies
            depInfo.required.forEach(reqType => {
                const exists = this.checkNFTypeExists(reqType);
                const isConnected = this.hasConnectionToType(nf, reqType);
                if (!exists || !isConnected) {
                    hasErrors = true;
                }
            });

            // Check optional dependencies
            depInfo.optional.forEach(optType => {
                const exists = this.checkNFTypeExists(optType);
                const isConnected = this.hasConnectionToType(nf, optType);
                if (!exists || !isConnected) {
                    hasWarnings = true;
                }
            });

            // Determine final status
            let finalStatus;
            if (!hasErrors && !hasWarnings) {
                finalStatus = scenario.final_status.all_ok;
            } else if (hasErrors) {
                finalStatus = scenario.final_status.failed;
            } else {
                finalStatus = scenario.final_status.partial;
            }

            if (finalStatus) {
                setTimeout(() => {
                    this.addLog(nf.id, finalStatus.level, finalStatus.message, finalStatus.details || {});
                }, finalStatus.delay);
            }
        }
    }

    /**
     * Fallback basic scenario
     */
    runBasicScenario(nf) {
        this.addLog(nf.id, 'INFO', `${nf.type} instance created: ${nf.name}`);

        setTimeout(() => {
            this.addLog(nf.id, 'INFO', `Initializing ${nf.type} services...`);
            setTimeout(() => {
                this.checkDependencies(nf);
            }, 500);
        }, 300);
    }

    checkDependencies(nf) {
        if (!this.dependencies || !this.dependencies[nf.type]) return;

        const depInfo = this.dependencies[nf.type];
        let hasErrors = false;

        depInfo.required.forEach((requiredType, index) => {
            setTimeout(() => {
                const exists = this.checkNFTypeExists(requiredType);
                const isConnected = this.hasConnectionToType(nf, requiredType);

                if (!exists) {
                    hasErrors = true;
                    this.addLog(nf.id, 'ERROR',
                        `Cannot register with ${requiredType} - ${requiredType} not found in topology`, {
                        suggestion: `Add ${requiredType} to the topology first`
                    });
                } else if (!isConnected) {
                    hasErrors = true;
                    this.addLog(nf.id, 'ERROR',
                        `${requiredType} exists but not connected`, {
                        suggestion: `Connect ${nf.name} to ${requiredType}`
                    });
                } else {
                    this.addLog(nf.id, 'SUCCESS',
                        `Connected to ${requiredType} successfully`);
                }
            }, 200 * index);
        });

        depInfo.optional.forEach((optionalType, index) => {
            setTimeout(() => {
                const exists = this.checkNFTypeExists(optionalType);
                const isConnected = this.hasConnectionToType(nf, optionalType);

                if (!exists || !isConnected) {
                    this.addLog(nf.id, 'WARNING',
                        `${optionalType} not available - Some features may not work`);
                }
            }, 200 * (depInfo.required.length + index));
        });

        setTimeout(() => {
            if (hasErrors) {
                this.addLog(nf.id, 'ERROR',
                    `${nf.type} startup failed - Cannot operate without required dependencies`);
            } else {
                this.addLog(nf.id, 'SUCCESS',
                    `${nf.type} is fully operational ✓`);
            }
        }, 200 * (depInfo.required.length + depInfo.optional.length) + 500);
    }

    /**
     * Connection Created - Generate connection logs
     */
    onConnectionCreated(connection) {
        const sourceNF = window.dataStore?.getNFById(connection.sourceId);
        const targetNF = window.dataStore?.getNFById(connection.targetId);

        if (!sourceNF || !targetNF) return;

        console.log('📋 LogEngine: Connection Created');

        // Check if we have custom scenario
        const hasCustom = this.logScenarios &&
            this.logScenarios[sourceNF.type] &&
            this.logScenarios[sourceNF.type].dependencies &&
            this.logScenarios[sourceNF.type].dependencies[targetNF.type];

        if (hasCustom) {
            // Use custom connection logs
            const depConfig = this.logScenarios[sourceNF.type].dependencies[targetNF.type];

            if (depConfig.connected) {
                setTimeout(() => {
                    this.addLog(sourceNF.id, depConfig.connected.level,
                        depConfig.connected.message,
                        depConfig.connected.details || {});
                }, depConfig.connected.delay || 500);
            }

            if (depConfig.registered) {
                setTimeout(() => {
                    this.addLog(sourceNF.id, depConfig.registered.level,
                        depConfig.registered.message,
                        depConfig.registered.details || {});
                }, depConfig.registered.delay || 1000);
            }

            // Also check if target NF needs to log something
            if (targetNF.type === 'NRF' && sourceNF.type !== 'NRF') {
                this.simulateNRFRegistration(sourceNF, targetNF);
            }

        } else {
            // Use default connection logs
            this.addLog(connection.sourceId, 'INFO',
                `Initiating ${connection.interfaceName} connection to ${targetNF.name}`, {
                protocol: 'HTTP/2',
                targetIP: targetNF.config.ipAddress,
                targetPort: targetNF.config.port
            });

            this.addLog(connection.targetId, 'INFO',
                `Incoming connection request from ${sourceNF.name}`, {
                interface: connection.interfaceName,
                sourceIP: sourceNF.config.ipAddress
            });

            setTimeout(() => {
                this.addLog(connection.sourceId, 'INFO', 'TLS handshake in progress...');
                this.addLog(connection.targetId, 'INFO', 'Accepting TLS connection...');
            }, 300);

            setTimeout(() => {
                this.addLog(connection.sourceId, 'SUCCESS', 'TLS handshake complete');
                this.addLog(connection.targetId, 'SUCCESS', 'TLS session established');
            }, 700);

            setTimeout(() => {
                this.addLog(connection.sourceId, 'INFO', 'HTTP/2 connection upgrade...');
            }, 1000);

            setTimeout(() => {
                this.addLog(connection.sourceId, 'SUCCESS',
                    `${connection.interfaceName} connection established with ${targetNF.name}`, {
                    endpoint: `https://${targetNF.config.ipAddress}:${targetNF.config.port}`,
                    protocol: 'HTTP/2',
                    status: 'ACTIVE'
                });

                this.addLog(connection.targetId, 'SUCCESS',
                    `${connection.interfaceName} connection active from ${sourceNF.name}`);

                // Re-check dependencies
                setTimeout(() => {
                    this.recheckDependenciesAfterConnection(sourceNF);
                    this.recheckDependenciesAfterConnection(targetNF);
                }, 500);

                if (targetNF.type === 'NRF') {
                    this.simulateNRFRegistration(sourceNF, targetNF);
                }

            }, 1500);
        }
    }

    /**
     * Simulate NRF registration
     */
    simulateNRFRegistration(nf, nrfNF) {
        setTimeout(() => {
            this.addLog(nf.id, 'INFO',
                'Sending NF registration request to NRF...', {
                method: 'PUT',
                endpoint: '/nnrf-nfm/v1/nf-instances/' + nf.id,
                payload: 'NF Profile'
            });
        }, 500);

        setTimeout(() => {
            const profileId = `profile-${Math.random().toString(36).substr(2, 9)}`;

            this.addLog(nrfNF.id, 'INFO',
                `Processing registration from ${nf.name}`, {
                nfType: nf.type,
                nfInstanceId: nf.id
            });

            this.addLog(nrfNF.id, 'SUCCESS',
                `${nf.name} registered successfully`, {
                profileId: profileId,
                validity: '3600 seconds',
                status: 'REGISTERED'
            });

            this.addLog(nf.id, 'SUCCESS',
                'Successfully registered with NRF', {
                profileId: profileId,
                nrfAddress: nrfNF.config.ipAddress,
                heartbeatInterval: '60 seconds'
            });

        }, 1200);
    }

    /**
     * Re-check dependencies after connection
     */
    recheckDependenciesAfterConnection(nf) {
        if (!this.dependencies || !this.dependencies[nf.type]) return;

        const depInfo = this.dependencies[nf.type];
        let allSatisfied = true;
        let newlySatisfied = [];

        // Check all required dependencies
        depInfo.required.forEach(reqType => {
            const exists = this.checkNFTypeExists(reqType);
            const isConnected = this.hasConnectionToType(nf, reqType);

            if (!exists || !isConnected) {
                allSatisfied = false;
            } else {
                newlySatisfied.push(reqType);
            }
        });

        // If all dependencies are now satisfied
        if (allSatisfied && newlySatisfied.length > 0) {
            this.addLog(nf.id, 'SUCCESS',
                `All dependencies satisfied - ${nf.type} is now fully operational ✓`, {
                status: 'OPERATIONAL',
                mode: 'FULL',
                timestamp: new Date().toISOString()
            });
        } else if (newlySatisfied.length > 0) {
            // Some dependencies satisfied
            this.addLog(nf.id, 'INFO',
                `Dependencies resolved: ${newlySatisfied.join(', ')}`);
        }
    }

    onNFRemoved(nf) {
        console.log('📋 LogEngine: NF Removed:', nf.name);

        this.addLog(nf.id, 'WARNING',
            `${nf.type} instance ${nf.name} is shutting down`, {
            reason: 'Manual removal',
            timestamp: new Date().toISOString()
        });

        const connections = window.dataStore?.getConnectionsForNF(nf.id) || [];
        connections.forEach(conn => {
            const otherNfId = conn.sourceId === nf.id ? conn.targetId : conn.sourceId;
            const otherNf = window.dataStore?.getNFById(otherNfId);

            if (otherNf) {
                this.addLog(otherNfId, 'ERROR',
                    `Connection lost to ${nf.name}`, {
                    reason: 'Peer NF was removed from topology',
                    interface: conn.interfaceName,
                    impact: 'Service disruption'
                });

                setTimeout(() => {
                    this.checkDependencies(otherNf);
                }, 1000);
            }
        });
    }

    onConnectionDeleted(connection) {
        const sourceNF = window.dataStore?.getNFById(connection.sourceId);
        const targetNF = window.dataStore?.getNFById(connection.targetId);

        if (sourceNF) {
            this.addLog(connection.sourceId, 'WARNING',
                `Connection to ${targetNF?.name || 'unknown'} closed`, {
                interface: connection.interfaceName,
                reason: 'Manual disconnection'
            });

            setTimeout(() => this.checkDependencies(sourceNF), 500);
        }

        if (targetNF) {
            this.addLog(connection.targetId, 'WARNING',
                `Connection from ${sourceNF?.name || 'unknown'} closed`);

            setTimeout(() => this.checkDependencies(targetNF), 500);
        }
    }

    checkNFTypeExists(type) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        return allNFs.some(nf => nf.type === type);
    }

    hasConnectionToType(nf, targetType) {
        // Check direct NF-to-NF connections
        const connections = window.dataStore?.getConnectionsForNF(nf.id) || [];
        const hasDirectConnection = connections.some(conn => {
            const otherNfId = conn.sourceId === nf.id ? conn.targetId : conn.sourceId;
            const otherNf = window.dataStore?.getNFById(otherNfId);
            return otherNf && otherNf.type === targetType;
        });

        if (hasDirectConnection) {
            return true;
        }

        // Check bus connections - if both NFs are on the same bus, consider them connected
        const busConnections = window.dataStore?.getBusConnectionsForNF(nf.id) || [];

        return busConnections.some(busConn => {
            // Get all NFs connected to the same bus
            const sameBusConnections = window.dataStore?.getBusConnectionsForBus(busConn.busId) || [];

            return sameBusConnections.some(otherBusConn => {
                if (otherBusConn.nfId !== nf.id) {
                    const otherNf = window.dataStore?.getNFById(otherBusConn.nfId);
                    return otherNf && otherNf.type === targetType;
                }
                return false;
            });
        });
    }

    /**
     * Get connection method (direct or bus)
     * @param {Object} nf - Network Function
     * @param {string} targetType - Target NF type
     * @returns {string} 'direct' or 'bus'
     */
    getConnectionMethod(nf, targetType) {
        // Check direct connections first
        const connections = window.dataStore?.getConnectionsForNF(nf.id) || [];
        const hasDirectConnection = connections.some(conn => {
            const otherNfId = conn.sourceId === nf.id ? conn.targetId : conn.sourceId;
            const otherNf = window.dataStore?.getNFById(otherNfId);
            return otherNf && otherNf.type === targetType;
        });

        if (hasDirectConnection) {
            return 'direct';
        }

        // Check bus connections
        const busConnections = window.dataStore?.getBusConnectionsForNF(nf.id) || [];
        const hasBusConnection = busConnections.some(busConn => {
            const sameBusConnections = window.dataStore?.getBusConnectionsForBus(busConn.busId) || [];
            return sameBusConnections.some(otherBusConn => {
                if (otherBusConn.nfId !== nf.id) {
                    const otherNf = window.dataStore?.getNFById(otherBusConn.nfId);
                    return otherNf && otherNf.type === targetType;
                }
                return false;
            });
        });

        return hasBusConnection ? 'bus' : 'none';
    }

    getAllLogs() {
        const allLogs = [];
        this.logs.forEach(nfLogs => {
            allLogs.push(...nfLogs);
        });
        return allLogs.sort((a, b) => a.timestamp - b.timestamp);
    }

    getLogsForNF(nfId) {
        return this.logs.get(nfId) || [];
    }

    clearLogsForNF(nfId) {
        this.logs.delete(nfId);
        this.notifyListeners({ type: 'clear', nfId });
    }

    clearAllLogs() {
        this.logs.clear();
        this.notifyListeners({ type: 'clear-all' });
    }

    subscribe(callback) {
        this.logListeners.push(callback);
    }

    notifyListeners(logEntry) {
        this.logListeners.forEach(callback => {
            try {
                callback(logEntry);
            } catch (error) {
                console.error('Error in log listener:', error);
            }
        });
    }

    exportLogsAsJSON() {
        const exportData = {
            exportTime: new Date().toISOString(),
            logs: this.getAllLogs()
        };
        return JSON.stringify(exportData, null, 2);
    }

    exportLogsAsCSV() {
        const logs = this.getAllLogs();
        const headers = ['Timestamp', 'NF Name', 'NF Type', 'Level', 'Message'];
        let csv = headers.join(',') + '\n';

        logs.forEach(log => {
            const nf = window.dataStore?.getNFById(log.nfId);
            const timestamp = new Date(log.timestamp).toISOString();
            csv += [
                timestamp,
                nf?.name || 'Unknown',
                nf?.type || 'Unknown',
                log.level,
                `"${log.message.replace(/"/g, '""')}"`
            ].join(',') + '\n';
        });

        return csv;
    }

    /**
     * Export logs as plain text
     * @returns {string} Plain text string of all logs
     */
    exportLogsAsText() {
        const logs = this.getAllLogs();
        let text = '═══════════════════════════════════════════════════════\n';
        text += '5G SBA DASHBOARD - LOG EXPORT\n';
        text += '═══════════════════════════════════════════════════════\n';
        text += `Export Time: ${new Date().toISOString()}\n`;
        text += `Total Logs: ${logs.length}\n`;
        text += '═══════════════════════════════════════════════════════\n\n';

        logs.forEach(log => {
            const nf = window.dataStore?.getNFById(log.nfId);
            const timestamp = new Date(log.timestamp).toLocaleString();

            text += `[${timestamp}] ${nf?.name || 'Unknown'} (${nf?.type || 'Unknown'}) - ${log.level}\n`;
            text += `${log.message}\n`;

            // Add details if present
            if (log.details && Object.keys(log.details).length > 0) {
                text += 'Details:\n';
                Object.entries(log.details).forEach(([key, value]) => {
                    text += `  ${key}: ${JSON.stringify(value)}\n`;
                });
            }
            text += '\n';
        });

        text += '═══════════════════════════════════════════════════════\n';
        text += 'END OF LOG EXPORT\n';
        text += '═══════════════════════════════════════════════════════\n';

        return text;
    }
}

