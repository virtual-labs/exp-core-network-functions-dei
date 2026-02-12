/**
 * ============================================
 * NETWORK FUNCTION MANAGER
 * ============================================
 * Manages creation, deletion, and lifecycle of Network Functions
 * 
 * Responsibilities:
 * - Create new NF instances
 * - Generate unique IDs
 * - Assign default configurations
 * - Handle NF positioning on canvas
 * - Track NF counters for naming
 */

class NFManager {
    constructor() {
        // Counter for each NF type for unique naming
        this.nfCounters = {
            'NRF': 0,
            'AMF': 0,
            'SMF': 0,
            'UPF': 0,
            'AUSF': 0,
            'UDM': 0,
            'PCF': 0,
            'NSSF': 0,
            'UDR': 0,
            'gNB': 0,
            'UE': 0,
            'MySQL': 0
        };

        console.log('✅ NFManager initialized');
    }

    /**
     * Create a new Network Function
     * @param {string} type - Type of NF (AMF, SMF, etc.)
     * @param {Object} position - {x, y} coordinates on canvas (optional)
     * @returns {Object} Created NF object
     */

    createNetworkFunction(type, position = null) {
        console.log('🔧 NFManager: Creating NF of type:', type);

        this.nfCounters[type]++;
        const count = this.nfCounters[type];

        if (!position) {
            position = this.calculateAutoPosition(type, count);
        }

        const nfDef = this.getNFDefinition(type);

        // Get global protocol (default HTTP/2)
        const globalProtocol = window.globalHTTPProtocol || 'HTTP/2';

        // Generate unique IP address to prevent conflicts
        const uniqueIP = this.generateUniqueIPAddress();
        const uniquePort = this.generateUniquePort();

        // Create NF object
        const nf = {
            id: this.generateUniqueId(type),
            type: type,
            name: `${type}-${count}`,
            position: position,
            color: nfDef.color,
            icon: nfDef.icon,
            iconImage: null, // Will store loaded Image object
            status: 'starting', // NEW: Start with 'starting' status
            statusTimestamp: Date.now(), // NEW: Track when status was set
            config: {
                ipAddress: uniqueIP,
                port: uniquePort,
                capacity: 1000,
                load: 0,
                httpProtocol: globalProtocol  // NEW: Add protocol property
            }
        };

        // =========================================
        // LOAD ICON IMAGE FROM SVG FILE
        // =========================================
        if (nf.icon) {
            console.log('🔄 Attempting to load icon for', nf.name + ':', nf.icon);
            console.log('🔍 Current location:', window.location.href);

            // Ensure the path is resolved correctly relative to the current page
            const iconPath = nf.icon.startsWith('http') ? nf.icon : nf.icon;
            const fullIconURL = new URL(iconPath, window.location.href).href;
            console.log('🔍 Full icon URL will be:', fullIconURL);

            const img = new Image();

            // Don't set CORS for local files as it can cause issues
            // img.crossOrigin = 'anonymous';

            img.onload = () => {
                console.log('✅ Icon loaded successfully for', nf.name + ':', nf.icon);
                console.log('✅ Image dimensions:', img.width, 'x', img.height);
                nf.iconImage = img;
                // Re-render to show the loaded icon
                if (window.canvasRenderer) {
                    console.log('🎨 Re-rendering canvas to show loaded icon');
                    window.canvasRenderer.render();
                }
            };

            img.onerror = (error) => {
                console.error('❌ Failed to load icon for', nf.name + ':', nf.icon);
                console.error('❌ Error event:', error);
                console.error('❌ Attempted URL:', img.src);

                // Try alternative paths
                const alternativePaths = [
                    `./${nf.icon}`,
                    `../${nf.icon}`,
                    nf.icon.replace('images/', './images/'),
                    nf.icon.replace('images/', '../images/')
                ];

                let pathIndex = 0;

                function tryNextPath() {
                    if (pathIndex >= alternativePaths.length) {
                        console.error('❌ All alternative paths failed for', nf.name);
                        nf.iconImage = null; // Will show fallback
                        return;
                    }

                    const altPath = alternativePaths[pathIndex++];
                    console.log('🔄 Trying alternative path:', altPath);

                    const alternativeImg = new Image();
                    alternativeImg.onload = () => {
                        console.log('✅ Alternative icon loaded for', nf.name, 'using path:', altPath);
                        nf.iconImage = alternativeImg;
                        if (window.canvasRenderer) {
                            window.canvasRenderer.render();
                        }
                    };
                    alternativeImg.onerror = () => {
                        console.log('❌ Alternative path failed:', altPath);
                        tryNextPath();
                    };
                    alternativeImg.src = altPath;
                }

                tryNextPath();
            };

            // Add a timeout to detect hanging loads
            setTimeout(() => {
                if (!img.complete && !nf.iconImage) {
                    console.warn('⏰ Icon loading timeout for', nf.name + ':', nf.icon);
                }
            }, 5000);

            img.src = iconPath; // This triggers the load
        } else {
            console.warn('⚠️ No icon path defined for NF type:', type);
        }

        console.log('✅ NF created:', nf);

        // Add to data store
        if (window.dataStore) {
            window.dataStore.addNF(nf);
        } else {
            console.error('❌ DataStore not available!');
            return null;
        }

        // Trigger log engine
        if (window.logEngine) {
            window.logEngine.onNFAdded(nf);
        }

        // Force canvas re-render
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }

        // NEW: Start service lifecycle management
        this.startServiceLifecycle(nf);

        return nf;
    }

    // createNetworkFunction(type, position = null) {
    //     console.log('🔧 NFManager: Creating NF of type:', type);

    //     // Increment counter for this NF type
    //     this.nfCounters[type]++;
    //     const count = this.nfCounters[type];

    //     // Auto-position if not provided
    //     if (!position) {
    //         position = this.calculateAutoPosition(type, count);
    //     }

    //     // Get NF definition (color, icon, etc.)
    //     const nfDef = this.getNFDefinition(type);

    //     // Create NF object
    //     const nf = {
    //         id: this.generateUniqueId(type),
    //         type: type,
    //         name: `${type}-${count}`,
    //         position: position,
    //         color: nfDef.color,
    //         icon: nfDef.icon,
    //         status: 'active',
    //         config: {
    //             ipAddress: `192.168.1.${10 + count}`,
    //             port: 8080 + count,
    //             capacity: 1000,
    //             load: 0
    //         }
    //     };

    //     console.log('✅ NF created:', nf);

    //     // Add to data store
    //     if (window.dataStore) {
    //         window.dataStore.addNF(nf);
    //     } else {
    //         console.error('❌ DataStore not available!');
    //         return null;
    //     }

    //     // Trigger log engine
    //     if (window.logEngine) {
    //         window.logEngine.onNFAdded(nf);
    //     }

    //     // Force canvas re-render
    //     if (window.canvasRenderer) {
    //         window.canvasRenderer.render();
    //     }

    //     return nf;
    // }

    /**
     * Generate unique ID for NF
     * @param {string} type - NF type
     * @returns {string} Unique ID
     */
    generateUniqueId(type) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 7);
        return `${type.toLowerCase()}-${timestamp}-${random}`;
    }

    /**
     * Generate unique IP address to prevent conflicts (UPDATED for real-time availability)
     * @returns {string} Unique IP address
     */
    generateUniqueIPAddress() {
        // Get fresh list of used IPs every time
        const allNFs = window.dataStore?.getAllNFs() || [];
        const usedIPs = new Set(allNFs.map(nf => nf.config.ipAddress));
        
        console.log(`🔍 Checking IP availability. Currently used IPs:`, Array.from(usedIPs));
        
        // Define different subnets for different types of services
        const subnets = [
            '192.168.1', // Core network functions
            '192.168.2', // User plane functions
            '192.168.3', // Edge services
            '192.168.4'  // Additional services
        ];

        // Try to find available IP in each subnet
        for (const subnet of subnets) {
            for (let host = 10; host <= 254; host++) {
                const ip = `${subnet}.${host}`;
                if (!usedIPs.has(ip)) {
                    console.log(`🌐 Generated unique IP: ${ip} (subnet: ${subnet}.0/24)`);
                    return ip;
                }
            }
        }

        // Fallback: generate random IP if all subnets are full
        const randomSubnet = Math.floor(Math.random() * 254) + 1;
        const randomHost = Math.floor(Math.random() * 244) + 10;
        const fallbackIP = `192.168.${randomSubnet}.${randomHost}`;
        
        console.warn(`⚠️ All predefined subnets full, using fallback IP: ${fallbackIP}`);
        return fallbackIP;
    }

    /**
     * Generate unique port number to prevent conflicts (UPDATED for real-time availability)
     * @returns {number} Unique port number
     */
    generateUniquePort() {
        // Get fresh list of used ports every time
        const allNFs = window.dataStore?.getAllNFs() || [];
        const usedPorts = new Set(allNFs.map(nf => nf.config.port));
        
        console.log(`🔍 Checking port availability. Currently used ports:`, Array.from(usedPorts));
        
        // Start from port 8080 and find next available
        for (let port = 8080; port <= 9999; port++) {
            if (!usedPorts.has(port)) {
                console.log(`🔌 Generated unique port: ${port}`);
                return port;
            }
        }

        // Fallback: random port if all are used
        const randomPort = Math.floor(Math.random() * 1000) + 8000;
        console.warn(`⚠️ All standard ports (8080-9999) used, using fallback port: ${randomPort}`);
        return randomPort;
    }

    /**
     * Check if IP address is valid and available
     * @param {string} ipAddress - IP address to check
     * @returns {boolean} True if IP is available
     */
    isIPAddressAvailable(ipAddress) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        return !allNFs.some(nf => nf.config.ipAddress === ipAddress);
    }

    /**
     * Check if port is available
     * @param {number} port - Port number to check
     * @returns {boolean} True if port is available
     */
    isPortAvailable(port) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        return !allNFs.some(nf => nf.config.port === port);
    }

    /**
     * Get network from IP address (for subnet checking)
     * @param {string} ip - IP address
     * @returns {string} Network address (e.g., "192.168.1")
     */
    getNetworkFromIP(ip) {
        const parts = ip.split('.');
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }

    /**
     * Check if two IPs are in the same subnet
     * @param {string} ip1 - First IP address
     * @param {string} ip2 - Second IP address
     * @returns {boolean} True if in same subnet
     */
    areIPsInSameSubnet(ip1, ip2) {
        return this.getNetworkFromIP(ip1) === this.getNetworkFromIP(ip2);
    }

    /**
     * Get all NFs in the same subnet as given IP
     * @param {string} ipAddress - IP address to check
     * @returns {Array} Array of NFs in same subnet
     */
    getNFsInSameSubnet(ipAddress) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const targetNetwork = this.getNetworkFromIP(ipAddress);
        
        return allNFs.filter(nf => 
            this.getNetworkFromIP(nf.config.ipAddress) === targetNetwork
        );
    }

    /**
     * Calculate automatic position for NF on canvas
     * @param {string} type - NF type
     * @param {number} count - Current count of this NF type
     * @returns {Object} {x, y} position
     */
    calculateAutoPosition(type, count) {
        // NEW: Better grid layout with proper spacing
        const nfsPerRow = 6;  // More NFs per row for better utilization
        const nfWidth = 60;   // Smaller width to fit more NFs
        const nfHeight = 80;  // Height including label space
        const marginX = 40;   // Horizontal spacing between NFs
        const marginY = 60;   // Vertical spacing between rows
        const startX = 120;   // Start position X
        const startY = 120;   // Start position Y

        const row = Math.floor((count - 1) / nfsPerRow);
        const col = (count - 1) % nfsPerRow;

        return {
            x: startX + col * (nfWidth + marginX),
            y: startY + row * (nfHeight + marginY)
        };
    }

    /**
     * Get NF definition from global definitions (PUBLIC METHOD)
     * @param {string} type - NF type
     * @returns {Object} NF definition with color, icon, etc.
     */
    getNFDefinition(type) {
        // Try to get from loaded definitions
        if (window.nfDefinitions && window.nfDefinitions[type]) {
            return window.nfDefinitions[type];
        }

        // Fallback default definitions
        const defaultDefs = {
            'NRF': { color: '#9b59b6', icon: null, name: 'Network Repository Function' },
            'AMF': { color: '#3498db', icon: null, name: 'Access and Mobility Management' },
            'SMF': { color: '#00bcd4', icon: null, name: 'Session Management Function' },
            'UPF': { color: '#4caf50', icon: null, name: 'User Plane Function' },
            'AUSF': { color: '#ff9800', icon: null, name: 'Authentication Server Function' },
            'UDM': { color: '#ff5722', icon: null, name: 'Unified Data Management' },
            'PCF': { color: '#e91e63', icon: null, name: 'Policy Control Function' },
            'NSSF': { color: '#ffc107', icon: null, name: 'Network Slice Selection' },
            'UDR': { color: '#009688', icon: null, name: 'Unified Data Repository' },
            'gNB': { color: '#8e44ad', icon: null, name: 'gNodeB (5G Base Station)' },
            'UE': { color: '#16a085', icon: null, name: 'User Equipment' },
            'MySQL': { color: '#d35400', icon: null, name: 'MySQL Database' }
        };

        return defaultDefs[type] || { color: '#95a5a6', icon: null, name: type };
    }

    /**
     * Delete a Network Function
     * @param {string} nfId - ID of NF to delete
     */
    deleteNetworkFunction(nfId) {
        const nf = window.dataStore.getNFById(nfId);

        if (!nf) {
            console.warn('⚠️ NF not found:', nfId);
            return;
        }

        console.log('🗑️ Deleting NF:', nf.name);

        // Trigger log engine before deletion
        if (window.logEngine) {
            window.logEngine.onNFRemoved(nf);
        }

        // Remove from data store (this also removes connections)
        window.dataStore.removeNF(nfId);

        // Re-render canvas
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Update NF configuration
     * @param {string} nfId - NF ID
     * @param {Object} config - New configuration values
     */
    updateNFConfig(nfId, config) {
        const nf = window.dataStore.getNFById(nfId);

        if (!nf) {
            console.warn('⚠️ NF not found:', nfId);
            return;
        }

        // Update config
        Object.assign(nf.config, config);

        // Update in data store
        window.dataStore.updateNF(nfId, { config: nf.config });

        console.log('✅ NF config updated:', nf.name);

        // Re-render canvas
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Move NF to new position
     * @param {string} nfId - NF ID
     * @param {Object} position - New {x, y} position
     */
    moveNF(nfId, position) {
        const nf = window.dataStore.getNFById(nfId);

        if (!nf) return;

        nf.position = position;
        window.dataStore.updateNF(nfId, { position });

        // Re-render canvas
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Get count of NFs by type
     * @param {string} type - NF type
     * @returns {number} Count of NFs of this type
     */
    getNFCountByType(type) {
        const allNFs = window.dataStore.getAllNFs();
        return allNFs.filter(nf => nf.type === type).length;
    }

    /**
     * Get all NF types that exist in topology
     * @returns {Array} Array of unique NF types
     */
    getExistingNFTypes() {
        const allNFs = window.dataStore.getAllNFs();
        const types = allNFs.map(nf => nf.type);
        return [...new Set(types)]; // Unique types only
    }

    /**
     * Update ALL NFs to use new HTTP protocol
     * @param {string} newProtocol - 'HTTP/1' or 'HTTP/2'
     */
    updateGlobalProtocol(newProtocol) {
        console.log('🔄 Updating global HTTP protocol to:', newProtocol);

        // Update global variable
        window.globalHTTPProtocol = newProtocol;

        // Update all existing NFs
        const allNFs = window.dataStore?.getAllNFs() || [];
        let updateCount = 0;

        allNFs.forEach(nf => {
            if (nf.config.httpProtocol !== newProtocol) {
                const previousProtocol = nf.config.httpProtocol;
                nf.config.httpProtocol = newProtocol;
                window.dataStore.updateNF(nf.id, { config: nf.config });
                updateCount++;

                // Add log for protocol change
                if (window.logEngine) {
                    window.logEngine.addLog(nf.id, 'INFO',
                        `HTTP protocol updated to ${newProtocol}`, {
                        previousProtocol: previousProtocol || 'Unknown',
                        newProtocol: newProtocol,
                        reason: 'Global protocol synchronization'
                    });
                }
            }
        });

        console.log(`✅ Updated ${updateCount} NFs to ${newProtocol}`);

        // Update all connections
        const allConnections = window.dataStore?.getAllConnections() || [];
        allConnections.forEach(conn => {
            conn.protocol = newProtocol;
        });

        // Re-render canvas
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }

        return updateCount;
    }

    /**
     * Start service lifecycle management
     * @param {Object} nf - Network Function
     */
    startServiceLifecycle(nf) {
        console.log(`🔄 Starting lifecycle for ${nf.name}`);

        // After 5 seconds, change status to stable
        setTimeout(() => {
            if (window.dataStore?.getNFById(nf.id)) { // Check if NF still exists
                nf.status = 'stable';
                nf.statusTimestamp = Date.now();
                
                // Update in data store
                window.dataStore.updateNF(nf.id, nf);
                
                // Log status change
                if (window.logEngine) {
                    window.logEngine.addLog(nf.id, 'SUCCESS', 
                        `${nf.name} is now STABLE and ready for connections`, {
                        previousStatus: 'starting',
                        newStatus: 'stable',
                        uptime: '5 seconds',
                        readyForConnections: true
                    });
                }

                // Re-render canvas to show green status
                if (window.canvasRenderer) {
                    window.canvasRenderer.render();
                }

                console.log(`✅ ${nf.name} is now STABLE`);

                // Schedule auto-connections after 8-10 seconds total
                const autoConnectDelay = 3000 + Math.random() * 2000; // 3-5 more seconds
                setTimeout(() => {
                    this.attemptAutoConnections(nf);
                }, autoConnectDelay);
            }
        }, 5000);
    }

    /**
     * Attempt to auto-create connections between stable services (SAME SUBNET ONLY)
     * @param {Object} nf - Network Function that just became stable
     */
    attemptAutoConnections(nf) {
        if (!window.dataStore?.getNFById(nf.id) || nf.status !== 'stable') {
            return; // NF was deleted or not stable
        }

        console.log(`🔗 Attempting auto-connections for ${nf.name} in subnet ${this.getNetworkFromIP(nf.config.ipAddress)}.0/24`);

        const allNFs = window.dataStore.getAllNFs();
        const sourceNetwork = this.getNetworkFromIP(nf.config.ipAddress);
        
        // SUBNET RESTRICTION: Only consider stable NFs in the SAME subnet
        const sameSubnetStableNFs = allNFs.filter(otherNf => 
            otherNf.id !== nf.id && 
            otherNf.status === 'stable' &&
            this.getNetworkFromIP(otherNf.config.ipAddress) === sourceNetwork
        );

        if (sameSubnetStableNFs.length === 0) {
            console.log(`ℹ️ No other stable services found in subnet ${sourceNetwork}.0/24 for ${nf.name}`);
            
            if (window.logEngine) {
                window.logEngine.addLog(nf.id, 'WARNING',
                    `No stable services in same subnet for auto-connection`, {
                    sourceSubnet: sourceNetwork + '.0/24',
                    sourceIP: nf.config.ipAddress,
                    restriction: 'Auto-connections only within same subnet',
                    suggestion: 'Add more services in the same subnet range'
                });
            }
            return;
        }

        // Auto-connection logic based on 5G architecture
        const autoConnectionRules = this.getAutoConnectionRules();
        const rulesToApply = autoConnectionRules[nf.type] || [];

        let connectionsCreated = 0;
        let connectionsBlocked = 0;

        rulesToApply.forEach(targetType => {
            // Only look for targets in the same subnet
            const targetNFs = sameSubnetStableNFs.filter(target => target.type === targetType);
            
            if (targetNFs.length > 0) {
                // Connect to the first available target of this type in same subnet
                const targetNF = targetNFs[0];
                
                // Check if connection already exists
                const existingConnections = window.dataStore.getConnectionsForNF(nf.id);
                const alreadyConnected = existingConnections.some(conn => 
                    conn.sourceId === targetNF.id || conn.targetId === targetNF.id
                );

                if (!alreadyConnected && window.connectionManager) {
                    // Create auto-connection (logical only, no visual line)
                    const connection = window.connectionManager.createAutoConnection(nf.id, targetNF.id);
                    if (connection) {
                        connectionsCreated++;
                        console.log(`✅ Auto-connected ${nf.name} → ${targetNF.name} (same subnet: ${sourceNetwork}.0/24)`);
                        
                        // Log auto-connection with subnet info
                        if (window.logEngine) {
                            window.logEngine.addLog(nf.id, 'INFO',
                                `Auto-connected to ${targetNF.name} (logical connection - no visual line)`, {
                                targetType: targetNF.type,
                                interface: connection.interfaceName,
                                autoConnection: true,
                                visualConnection: false,
                                subnet: sourceNetwork + '.0/24',
                                sourceIP: nf.config.ipAddress,
                                targetIP: targetNF.config.ipAddress,
                                reason: '5G architecture requirement + subnet restriction',
                                note: 'Connection exists for communication but not shown on canvas'
                            });
                        }
                    }
                }
            } else {
                // Target type exists but not in same subnet
                const allTargetsOfType = allNFs.filter(otherNf => 
                    otherNf.id !== nf.id && 
                    otherNf.status === 'stable' &&
                    otherNf.type === targetType
                );
                
                if (allTargetsOfType.length > 0) {
                    connectionsBlocked++;
                    console.log(`🚫 Auto-connection blocked: ${targetType} exists but not in same subnet as ${nf.name}`);
                }
            }
        });

        // Log results
        if (connectionsCreated > 0) {
            if (window.logEngine) {
                window.logEngine.addLog(nf.id, 'SUCCESS',
                    `Auto-connection completed: ${connectionsCreated} connections created in subnet ${sourceNetwork}.0/24`, {
                    connectionsCreated: connectionsCreated,
                    connectionsBlocked: connectionsBlocked,
                    subnet: sourceNetwork + '.0/24',
                    sameSubnetStableServices: sameSubnetStableNFs.length,
                    restriction: 'Same-subnet connections only'
                });
            }

            // Re-render canvas to show new connections
            if (window.canvasRenderer) {
                window.canvasRenderer.render();
            }
        } else {
            console.log(`ℹ️ No auto-connections created for ${nf.name} in subnet ${sourceNetwork}.0/24`);
            
            if (connectionsBlocked > 0 && window.logEngine) {
                window.logEngine.addLog(nf.id, 'WARNING',
                    `Auto-connections blocked due to subnet restrictions`, {
                    connectionsBlocked: connectionsBlocked,
                    sourceSubnet: sourceNetwork + '.0/24',
                    reason: 'Required services exist but in different subnets',
                    solution: 'Move services to same subnet for auto-connection'
                });
            }
        }
    }

    /**
     * Get auto-connection rules based on 5G architecture
     * @returns {Object} Connection rules for each NF type
     */
    getAutoConnectionRules() {
        return {
            'AMF': ['NRF', 'AUSF', 'UDM'],
            'SMF': ['NRF', 'UPF', 'PCF'],
            'UPF': ['SMF'],
            'AUSF': ['NRF', 'UDM'],
            'UDM': ['NRF'],
            'PCF': ['NRF'],
            'NSSF': ['NRF'],
            'UDR': ['NRF'],
            'gNB': ['AMF', 'UPF'],
            'UE': ['gNB'],
            'MySQL': ['UDM']
        };
    }

    /**
     * Get service status color
     * @param {string} status - Service status
     * @returns {string} Color code
     */
    getStatusColor(status) {
        switch (status) {
            case 'starting': return '#e74c3c'; // Red
            case 'stable': return '#2ecc71';   // Green
            case 'error': return '#e67e22';    // Orange
            case 'stopped': return '#95a5a6';  // Gray
            default: return '#3498db';         // Blue
        }
    }

    /**
     * Get all stable services
     * @returns {Array} Array of stable NFs
     */
    getStableServices() {
        const allNFs = window.dataStore?.getAllNFs() || [];
        return allNFs.filter(nf => nf.status === 'stable');
    }

    /**
     * Get service uptime
     * @param {Object} nf - Network Function
     * @returns {string} Formatted uptime
     */
    getServiceUptime(nf) {
        if (!nf.statusTimestamp) return 'Unknown';
        
        const uptimeMs = Date.now() - nf.statusTimestamp;
        const uptimeSeconds = Math.floor(uptimeMs / 1000);
        
        if (uptimeSeconds < 60) {
            return `${uptimeSeconds} seconds`;
        } else if (uptimeSeconds < 3600) {
            const minutes = Math.floor(uptimeSeconds / 60);
            return `${minutes} minutes`;
        } else {
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }
}