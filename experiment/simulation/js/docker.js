/**
 * ============================================
 * DOCKER TERMINAL MANAGER
 * ============================================
 * Manages Docker terminal functionality for managing Network Functions
 * 
 * Responsibilities:
 * - Docker compose commands (up, down, ps)
 * - Start/stop individual NFs
 * - Display service status with health indicators
 * - Watch mode for real-time status updates
 */

class DockerTerminal {
    constructor() {
        this.watchInterval = null;
        this.isWatching = false;
        this.dockerServices = new Map(); // Map of service name to status
        
        // Terminal window state
        this.terminalState = {
            x: null,
            y: null,
            width: 900,
            height: 700,
            isMaximized: false,
            isMinimized: false
        };
        
        // Network state
        this.oaiWorkshopNetworkExists = false;
        this.oaiWorkshopNetworkId = this.generateNetworkId();
        this.oaiWorkshopCreatedTime = null;
        
        console.log('✅ DockerTerminal initialized');
    }

    /**
     * Initialize Docker terminal button
     */
    init() {
        // Button is added in HTML, just setup click handler if needed
        console.log('✅ Docker terminal ready');
    }

    /**
     * Open Docker terminal modal
     */
    openTerminal() {
        // Remove existing terminal if any
        const existingTerminal = document.getElementById('docker-terminal-modal');
        if (existingTerminal) {
            existingTerminal.remove();
        }

        // Create terminal modal
        const terminalModal = document.createElement('div');
        terminalModal.id = 'docker-terminal-modal';
        terminalModal.className = 'docker-terminal-modal';
        
        terminalModal.innerHTML = `
            <div class="docker-terminal-window" id="docker-terminal-window">
                <div class="docker-terminal-titlebar" id="docker-terminal-titlebar">
                    <div class="docker-terminal-title">
                        <span class="docker-terminal-icon">🐳</span>
                        Docker Terminal - Main Terminal
                    </div>
                    <div class="docker-terminal-controls">
                        <button class="docker-terminal-btn minimize" id="docker-terminal-minimize" title="Minimize">−</button>
                        <button class="docker-terminal-btn maximize" id="docker-terminal-maximize" title="Maximize">□</button>
                        <button class="docker-terminal-btn close" id="docker-terminal-close" title="Close">×</button>
                    </div>
                </div>
                <div class="docker-terminal-content" id="docker-terminal-content">
                    <div class="docker-terminal-header">
                        Docker Terminal v1.0<br>
                        Type 'help' for available commands<br><br>
                    </div>
                    <div class="docker-terminal-output" id="docker-terminal-output"></div>
                    <div class="docker-terminal-input-line">
                        <span class="docker-terminal-prompt">docker@main></span>
                        <input type="text" id="docker-terminal-input" class="docker-terminal-input" autocomplete="off" spellcheck="false">
                    </div>
                </div>
                <div class="docker-terminal-resize-handle" id="docker-terminal-resize-handle"></div>
            </div>
        `;

        document.body.appendChild(terminalModal);

        // Setup terminal functionality
        this.setupTerminal(terminalModal);
        
        // Setup dragging, resizing, and window controls
        this.setupWindowControls(terminalModal);

        // Apply saved position and size
        this.applyTerminalState();

        // Show terminal with animation
        setTimeout(() => {
            terminalModal.classList.add('show');
        }, 10);

        // Focus on input
        const input = document.getElementById('docker-terminal-input');
        if (input) {
            input.focus();
        }
    }

    /**
     * Setup Docker terminal functionality
     * @param {HTMLElement} terminalModal - Terminal modal element
     */
    setupTerminal(terminalModal) {
        const input = document.getElementById('docker-terminal-input');
        const output = document.getElementById('docker-terminal-output');
        const closeBtn = document.getElementById('docker-terminal-close');
        
        let commandHistory = [];
        let historyIndex = -1;

        // Close button
        closeBtn.addEventListener('click', () => {
            this.stopWatch();
            terminalModal.classList.remove('show');
            setTimeout(() => {
                terminalModal.remove();
            }, 300);
        });

        // Click outside to close
        terminalModal.addEventListener('click', (e) => {
            if (e.target === terminalModal) {
                closeBtn.click();
            }
        });

        // Input handling
        input.addEventListener('keydown', async (e) => {
            // Handle Ctrl+C to stop watch mode
            if (e.ctrlKey && e.key === 'c' && this.isWatching) {
                e.preventDefault();
                this.stopWatch();
                this.addTerminalLine(output, '', 'blank');
                this.addTerminalLine(output, 'Watch mode stopped.', 'info');
                this.addTerminalLine(output, '', 'blank');
                return;
            }

            if (e.key === 'Enter') {
                const command = input.value.trim();
                if (command) {
                    // Add to history
                    commandHistory.push(command);
                    historyIndex = commandHistory.length;

                    // Display command
                    this.addTerminalLine(output, `docker@main>${command}`, 'command');
                    
                    // Clear input
                    input.value = '';

                    // Process command
                    await this.processCommand(command, output);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    input.value = commandHistory[historyIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    input.value = commandHistory[historyIndex];
                } else {
                    historyIndex = commandHistory.length;
                    input.value = '';
                }
            }
        });

        // Initial welcome message
        this.addTerminalLine(output, 'Welcome to Docker Terminal', 'info');
        this.addTerminalLine(output, 'Type "help" for available commands.', 'info');
        this.addTerminalLine(output, '', 'blank');
    }

    /**
     * Normalize command: collapse multiple spaces to one, trim, lowercase for matching
     * @param {string} command - Raw command string
     * @returns {string} Normalized command
     */
    normalizeCommand(command) {
        return command.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    /**
     * Process Docker command
     * @param {string} command - Command to process
     * @param {HTMLElement} output - Output element
     */
    async processCommand(command, output) {
        const cmd = this.normalizeCommand(command);
        const args = command.trim().split(/\s+/);

        if (cmd === 'help' || cmd === '?') {
            this.showHelp(output);
        } else if (cmd === 'status' || cmd === 'check') {
            this.checkSystemStatus(output);
        } else if (/^docker\s+compose\s+(-f\s+docker-compose\.yml\s+)?up\s+-d\s+(oai-[a-z0-9-]+|mysql)$/.test(cmd) ||
                   /^docker-compose\s+(-f\s+docker-compose\.yml\s+)?up\s+-d\s+(oai-[a-z0-9-]+|mysql)$/.test(cmd)) {
            // Extract service name from command (individual NF deployment) - last token
            const serviceName = (args[args.length - 1] || '').trim();
            await this.dockerComposeUpSingleNF(serviceName, output);
        } else if (/^docker\s+compose\s+(-f\s+docker-compose\.yml\s+)?up\s+-d\s*$/.test(cmd) ||
                   /^docker-compose\s+(-f\s+docker-compose\.yml\s+)?up\s+-d\s*$/.test(cmd)) {
            await this.dockerComposeUp(output);
        } else if (cmd === 'docker ps') {
            await this.dockerPS(output);
        } else if (cmd === 'docker network ls') {
            this.dockerNetworkLS(output);
        } else if (/^docker\s+network\s+inspect\s+.+$/.test(cmd)) {
            const networkName = args.slice(3).join(' ').trim();
            this.dockerNetworkInspect(networkName, output);
        } else if (cmd === 'docker version') {
            this.dockerVersion(output);
        } else if (/^watch\s+docker\s+(compose\s+)?(-f\s+docker-compose\.yml\s+)?ps\s+-a\s*$/.test(cmd) ||
                   /^watch\s+docker-compose\s+(-f\s+docker-compose\.yml\s+)?ps\s+-a\s*$/.test(cmd)) {
            this.startWatch(output);
        } else if (/^docker\s+compose\s+(-f\s+docker-compose\.yml\s+)?down\s+(oai-[a-z0-9-]+|mysql)$/.test(cmd) ||
                   /^docker-compose\s+(-f\s+docker-compose\.yml\s+)?down\s+(oai-[a-z0-9-]+|mysql)$/.test(cmd)) {
            const serviceName = (args[args.length - 1] || '').trim();
            await this.dockerComposeDownSingleNF(serviceName, output);
        } else if (/^docker\s+compose\s+(-f\s+docker-compose\.yml\s+)?down\s*$/.test(cmd) ||
                   /^docker-compose\s+(-f\s+docker-compose\.yml\s+)?down\s*$/.test(cmd)) {
            await this.dockerComposeDown(output);
        } else if (/^docker\s+start\s+.+$/.test(cmd)) {
            const serviceName = args.slice(2).join(' ');
            await this.dockerStart(serviceName, output);
        } else if (/^docker\s+stop\s+.+$/.test(cmd)) {
            const serviceName = args.slice(2).join(' ');
            await this.dockerStop(serviceName, output);
        } else if (cmd === 'cls' || cmd === 'clear') {
            output.innerHTML = '';
        } else if (cmd === 'exit') {
            const closeBtn = document.getElementById('docker-terminal-close');
            if (closeBtn) closeBtn.click();
        } else {
            this.addTerminalLine(output, `Command not found: ${command}`, 'error');
            this.addTerminalLine(output, 'Type "help" for available commands.', 'info');
        }

        this.addTerminalLine(output, '', 'blank');
    }

    /**
     * Check system status
     * @param {HTMLElement} output - Output element
     */
    checkSystemStatus(output) {
        this.addTerminalLine(output, 'System Status Check:', 'info');
        this.addTerminalLine(output, '', 'blank');
        
        // Check dataStore
        if (window.dataStore) {
            this.addTerminalLine(output, '✅ DataStore: Available', 'success');
            const allNFs = window.dataStore.getAllNFs() || [];
            this.addTerminalLine(output, `   Found ${allNFs.length} Network Function(s)`, 'info');
            
            if (allNFs.length > 0) {
                this.addTerminalLine(output, '', 'blank');
                this.addTerminalLine(output, 'Network Functions:', 'info');
                allNFs.forEach(nf => {
                    const status = nf.status || 'unknown';
                    const statusColor = status === 'stable' ? 'success' : (status === 'starting' ? 'warning' : 'info');
                    this.addTerminalLine(output, `  - ${nf.name} (${nf.type}): ${status}`, statusColor);
                });
            }
        } else {
            this.addTerminalLine(output, '❌ DataStore: Not available', 'error');
        }
        
        this.addTerminalLine(output, '', 'blank');
        
        // Check other managers
        if (window.nfManager) {
            this.addTerminalLine(output, '✅ NFManager: Available', 'success');
        } else {
            this.addTerminalLine(output, '❌ NFManager: Not available', 'error');
        }
        
        if (window.canvasRenderer) {
            this.addTerminalLine(output, '✅ CanvasRenderer: Available', 'success');
        } else {
            this.addTerminalLine(output, '❌ CanvasRenderer: Not available', 'error');
        }
    }

    /**
     * Show help
     * @param {HTMLElement} output - Output element
     */
    showHelp(output) {
        const helpText = [
            'Available Docker Commands:',
            '',
            '  docker compose -f docker-compose.yml up -d',
            '    Start all Network Functions (one-click deployment)',
            '',
            '  docker compose -f docker-compose.yml up -d <service-name>',
            '    Start a specific Network Function (e.g., oai-nrf, oai-amf, oai-smf)',
            '    Network will be created automatically on first NF deployment',
            '',
            '  docker ps',
            '    Show running Docker containers',
            '',
            '  docker network ls',
            '    List all Docker networks',
            '',
            '  docker network inspect <network-name>',
            '    Inspect a specific Docker network (bridge, host, none, oaiworkshop)',
            '',
            '  docker version',
            '    Show Docker version information',
            '',
            '  watch docker compose -f docker-compose.yml ps -a',
            '    Watch service status with auto-refresh (every 1 second)',
            '',
            '  docker compose -f docker-compose.yml down',
            '    Stop and remove all services',
            '',
            '  docker compose -f docker-compose.yml down <service-name>',
            '    Stop and remove a specific NF (e.g., docker compose -f docker-compose.yml down oai-nrf)',
            '',
            '  docker start <service-name>',
            '    Start a specific Network Function',
            '',
            '  docker stop <service-name>',
            '    Stop a specific Network Function',
            '',
            '  cls / clear',
            '    Clear the terminal screen',
            '',
            '  status / check',
            '    Check system status and list available NFs',
            '',
            '  exit',
            '    Close the terminal',
            ''
        ];

        helpText.forEach(line => {
            this.addTerminalLine(output, line, 'info');
        });
    }

    /**
     * Execute docker compose up -d (start all NFs)
     * @param {HTMLElement} output - Output element
     */
    async dockerComposeUp(output) {
        // Check if dataStore is available
        if (!window.dataStore) {
            this.addTerminalLine(output, 'Error: DataStore not initialized. Please refresh the page.', 'error');
            console.error('❌ DataStore not available');
            return;
        }

        // Check if NFManager is available
        if (!window.nfManager) {
            this.addTerminalLine(output, 'Error: NFManager not initialized. Please refresh the page.', 'error');
            console.error('❌ NFManager not available');
            return;
        }

        // Get all existing NFs from data store
        let existingNFs = window.dataStore.getAllNFs();
        
        // Get default NF configurations (all NFs that should exist)
        const defaultConfigs = this.getDefaultNFConfigurations();
        
        // Find which NFs are missing
        const existingTypes = new Set(existingNFs.map(nf => nf.type));
        const missingConfigs = defaultConfigs.filter(config => !existingTypes.has(config.type));
        
        // If no NFs exist at all, load topology from one-click.json
        if (existingNFs.length === 0) {
            try {
                // Load topology from one-click.json
                const response = await fetch('../one-click.json');
                if (!response.ok) {
                    throw new Error(`Failed to load one-click.json: ${response.statusText}`);
                }
                
                const topology = await response.json();
                
                // Filter out gNB and UE from topology
                const filteredTopology = this.filterTopology(topology);
                
                // Import filtered topology into dataStore
                // Set creation timestamps for all NFs before import
                const importTime = Date.now();
                if (filteredTopology.nfs && Array.isArray(filteredTopology.nfs)) {
                    filteredTopology.nfs.forEach(nf => {
                        nf.createdAt = importTime; // Set creation time
                    });
                }
                
                window.dataStore.importData(filteredTopology);
                
                // Load icon images and trigger logs for NFs
                if (filteredTopology.nfs && Array.isArray(filteredTopology.nfs)) {
                    for (const nf of filteredTopology.nfs) {
                        // Skip gNB and UE
                        if (nf.type === 'gNB' || nf.type === 'UE') continue;
                        
                        // Load icon image
                        if (nf.icon && !nf.iconImage) {
                            const img = new Image();
                            img.onload = () => {
                                nf.iconImage = img;
                                if (window.canvasRenderer) {
                                    window.canvasRenderer.render();
                                }
                            };
                            img.onerror = () => {
                                console.warn(`Failed to load icon for ${nf.name}: ${nf.icon}`);
                            };
                            img.src = nf.icon;
                        }
                        
                        // Trigger log engine for this NF to generate startup logs
                        if (window.logEngine) {
                            // Get the NF from dataStore after import
                            const importedNF = window.dataStore.getNFById(nf.id);
                            if (importedNF) {
                                // Use 5g-logs.json patterns for log generation
                                window.logEngine.onNFAdded(importedNF);
                            }
                        }
                    }
                }
                
                // Get updated list of NFs (no need to add more - topology has them all)
                existingNFs = window.dataStore.getAllNFs();

                // Re-render canvas to show imported topology
                if (window.canvasRenderer) {
                    window.canvasRenderer.render();
                }

                // Show compose-style output so user sees network and containers in terminal
                this.oaiWorkshopNetworkExists = true;
                this.oaiWorkshopCreatedTime = Date.now();
                const totalServices = existingNFs.length + 1; // +1 for network
                this.addTerminalLine(output, `[+] Running ${totalServices}/${totalServices}`, 'info');
                this.addTerminalLine(output, ' ✔ Network oaiworkshop Created' + ' '.repeat(20) + '0.2s', 'success');
                await this.delay(200);

                const serviceNameMap = {
                    'AMF': 'oai-amf', 'SMF': 'oai-smf', 'UPF': 'oai-upf', 'AUSF': 'oai-ausf',
                    'UDM': 'oai-udm', 'UDR': 'oai-udr', 'NRF': 'oai-nrf', 'PCF': 'oai-pcf',
                    'NSSF': 'oai-nssf', 'MySQL': 'mysql', 'ext-dn': 'oai-ext-dn'
                };
                for (const nf of existingNFs) {
                    const serviceName = serviceNameMap[nf.type] || nf.type.toLowerCase();
                    const randomDelay = (Math.random() * 0.5 + 0.3).toFixed(1);
                    this.addTerminalLine(output, ` ✔ Container ${serviceName.padEnd(16)} Started${' '.repeat(20)}${randomDelay}s`, 'success');
                    await this.delay(parseFloat(randomDelay) * 1000);
                }

                this.addTerminalLine(output, '', 'blank');
                this.addTerminalLine(output, `✅ Started ${existingNFs.length} Network Function(s)`, 'success');
                return;
                
            } catch (error) {
                this.addTerminalLine(output, `❌ Failed to load topology: ${error.message}`, 'error');
                this.addTerminalLine(output, 'Falling back to default NF creation...', 'warning');
                this.addTerminalLine(output, '', 'blank');
                
                // Fallback to default NFs if topology file fails
                await this.createDefaultNFs(output);
                existingNFs = window.dataStore.getAllNFs();
                
                // Re-render canvas
                if (window.canvasRenderer) {
                    window.canvasRenderer.render();
                }
                return;
            }
        }

        // If all NFs already exist, show message (and ensure network shows in docker network ls)
        if (missingConfigs.length === 0) {
            this.oaiWorkshopNetworkExists = true;
            if (!this.oaiWorkshopCreatedTime) this.oaiWorkshopCreatedTime = Date.now();
            this.addTerminalLine(output, '✅ All Network Functions are already running!', 'success');
            this.addTerminalLine(output, '', 'blank');
            this.addTerminalLine(output, 'Running services:', 'info');
            existingNFs.forEach(nf => {
                const serviceNameMap = {
                    'AMF': 'oai-amf', 'SMF': 'oai-smf', 'UPF': 'oai-upf', 'AUSF': 'oai-ausf',
                    'UDM': 'oai-udm', 'UDR': 'oai-udr', 'NRF': 'oai-nrf', 'PCF': 'oai-pcf',
                    'NSSF': 'oai-nssf', 'MySQL': 'mysql', 'ext-dn': 'oai-ext-dn'
                };
                const serviceName = serviceNameMap[nf.type] || nf.type.toLowerCase();
                const status = nf.status === 'stable' ? '(healthy)' : '(starting)';
                this.addTerminalLine(output, `  - ${serviceName.padEnd(16)} ${status}`, 'success');
            });
            return;
        }

        // Create network if it doesn't exist
        const isFirstNF = existingNFs.length === 0;
        const totalToStart = missingConfigs.length + (isFirstNF ? 1 : 0);
        
        this.addTerminalLine(output, `[+] Running ${totalToStart}/${totalToStart}`, 'info');
        
        if (isFirstNF) {
            this.addTerminalLine(output, ' ✔ Network oaiworkshop Created' + ' '.repeat(20) + '0.2s', 'success');
            this.oaiWorkshopNetworkExists = true;
            this.oaiWorkshopCreatedTime = Date.now();
            await this.delay(200);
        }
        
        // Load topology to get proper positions for missing NFs
        let topologyData = null;
        try {
            const response = await fetch('../one-click.json');
            if (response.ok) {
                const topology = await response.json();
                topologyData = this.filterTopology(topology);
            }
        } catch (error) {
            console.warn('Failed to load topology for NF positioning:', error);
        }
        
        // Start only missing NFs
        for (const config of missingConfigs) {
            // Try to find this NF in topology data
            let topologyNF = null;
            if (topologyData && topologyData.nfs) {
                topologyNF = topologyData.nfs.find(nf => nf.type === config.type);
            }
            
            let nf;
            if (topologyNF) {
                const posX = topologyNF.position?.x ?? topologyNF.x ?? 100;
                const posY = topologyNF.position?.y ?? topologyNF.y ?? 100;
                // Use topology data; canvas expects nf.position.x / nf.position.y
                nf = {
                    id: topologyNF.id || `nf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type: config.type,
                    name: topologyNF.name || config.type,
                    position: { x: posX, y: posY },
                    color: topologyNF.color,
                    config: {
                        ipAddress: config.ipAddress,
                        port: config.port,
                        httpProtocol: config.httpProtocol || 'HTTP/2',
                        capacity: topologyNF.config?.capacity || 1000,
                        load: topologyNF.config?.load || 0
                    },
                    icon: topologyNF.icon,
                    createdAt: Date.now(),
                    status: 'starting',
                    statusTimestamp: Date.now()
                };
                
                console.log('🚀 Creating NF from topology (batch):', nf);
                
                window.dataStore.addNF(nf);
                
                if (window.canvasRenderer) {
                    window.canvasRenderer.render();
                    console.log('✅ Canvas rendered after adding NF (batch)');
                }
                
                if (nf.icon) {
                    const img = new Image();
                    img.src = new URL(nf.icon.startsWith('http') ? nf.icon : nf.icon, window.location.href).href;
                    img.onload = () => {
                        nf.iconImage = img;
                        if (window.canvasRenderer) window.canvasRenderer.render();
                    };
                    img.onerror = () => {
                        img.src = new URL(`images/icons/${config.type.toLowerCase()}.svg`, window.location.href).href;
                        img.onerror = () => console.warn(`Failed to load icon for ${nf.name}`);
                    };
                }
                
                if (window.logEngine) window.logEngine.onNFAdded(nf);
            } else {
                // Fallback: Calculate position for the NF
                const currentNFCount = window.dataStore.getAllNFs().length;
                const position = window.nfManager.calculateAutoPosition(config.type, currentNFCount + 1);
                
                // Create the NF
                nf = window.nfManager.createNetworkFunction(config.type, position);
                
                if (!nf) {
                    this.addTerminalLine(output, `Error: Failed to create ${config.type}`, 'error');
                    continue;
                }

                // Apply configuration
                nf.config.ipAddress = config.ipAddress;
                nf.config.port = config.port;
                nf.config.httpProtocol = config.httpProtocol || 'HTTP/2';
                nf.createdAt = Date.now();
                nf.status = 'starting';
                nf.statusTimestamp = Date.now();
                
                // Update in data store
                window.dataStore.updateNF(nf.id, nf);
            }

            // Connect this NF to the Service Bus (so batch-started NFs also show on bus)
            if (topologyData && window.dataStore) {
                this.ensureNFConnectedToBus(nf, topologyData);
            }
            
            // Get service name
            const serviceNameMap = {
                'AMF': 'oai-amf', 'SMF': 'oai-smf', 'UPF': 'oai-upf', 'AUSF': 'oai-ausf',
                'UDM': 'oai-udm', 'UDR': 'oai-udr', 'NRF': 'oai-nrf', 'PCF': 'oai-pcf',
                'NSSF': 'oai-nssf', 'MySQL': 'mysql', 'ext-dn': 'oai-ext-dn'
            };
            const serviceName = serviceNameMap[nf.type] || nf.type.toLowerCase();
            
            // Show container creation with timing (random between 0.8s and 2.3s)
            const randomDelay = (Math.random() * 1.5 + 0.8).toFixed(1);
            this.addTerminalLine(output, ` ✔ Container ${serviceName.padEnd(16)} Started${' '.repeat(20)}${randomDelay}s`, 'success');
            await this.delay(parseFloat(randomDelay) * 1000);
            
            // Generate startup log
            if (window.logEngine) {
                window.logEngine.addLog(nf.id, 'INFO', 
                    `${nf.name} starting via docker compose`, {
                    ipAddress: nf.config.ipAddress,
                    port: nf.config.port,
                    protocol: nf.config.httpProtocol,
                    status: 'starting',
                    source: 'docker-compose'
                });
            }

            // After 5 seconds, set to stable and (if UPF) auto-connect SMF and ext-dn
            setTimeout(() => {
                const updatedNF = window.dataStore?.getNFById(nf.id);
                if (updatedNF) {
                    updatedNF.status = 'stable';
                    updatedNF.statusTimestamp = Date.now();
                    if (!updatedNF.createdAt && nf.createdAt) {
                        updatedNF.createdAt = nf.createdAt;
                    }
                    window.dataStore.updateNF(updatedNF.id, updatedNF);
                    
                    if (window.logEngine) {
                        window.logEngine.addLog(updatedNF.id, 'SUCCESS', 
                            `${updatedNF.name} is now STABLE and ready for connections`, {
                            previousStatus: 'starting',
                            newStatus: 'stable',
                            uptime: '5 seconds',
                            readyForConnections: true
                        });
                    }
                    
                    if (updatedNF.type === 'UPF') {
                        window.dockerTerminal.autoConnectUPFToSMFAndExtDn(updatedNF);
                    }
                    
                    if (window.canvasRenderer) window.canvasRenderer.render();
                }
            }, 5000);
        }
        
        this.addTerminalLine(output, '', 'blank');
        
        // Show summary
        if (missingConfigs.length > 0) {
            this.addTerminalLine(output, `✅ Started ${missingConfigs.length} new Network Function(s)`, 'success');
            if (existingNFs.length > 0) {
                this.addTerminalLine(output, `ℹ️  ${existingNFs.length} Network Function(s) were already running`, 'info');
            }
        }

        // Re-render canvas
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Execute docker ps (show running containers)
     * @param {HTMLElement} output - Output element
     */
    async dockerPS(output) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        
        if (allNFs.length === 0) {
            this.addTerminalLine(output, 'No containers running.', 'info');
            return;
        }

        // Header
        this.addTerminalLine(output, 'CONTAINER ID   IMAGE                                          COMMAND                  CREATED       STATUS                 PORTS                                                   NAMES', 'info');
        this.addTerminalLine(output, '────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────', 'info');

        // Map NF types to Docker service names
        const serviceNameMap = {
            'AMF': 'oai-amf',
            'SMF': 'oai-smf',
            'UPF': 'oai-upf',
            'AUSF': 'oai-ausf',
            'UDM': 'oai-udm',
            'UDR': 'oai-udr',
            'NRF': 'oai-nrf',
            'PCF': 'oai-pcf',
            'NSSF': 'oai-nssf',
            'MySQL': 'mysql',
            'ext-dn': 'ext-dn',
            'gNB': 'oai-gnb',
            'UE': 'oai-ue'
        };

        // Image map
        const imageMap = {
            'AMF': 'ghcr.io/openairinterface/oai-amf:develop',
            'SMF': 'ghcr.io/openairinterface/oai-smf:develop',
            'UPF': 'ghcr.io/openairinterface/oai-upf:develop',
            'AUSF': 'ghcr.io/openairinterface/oai-ausf:develop',
            'UDM': 'ghcr.io/openairinterface/oai-udm:develop',
            'UDR': 'ghcr.io/openairinterface/oai-udr:develop',
            'NRF': 'ghcr.io/openairinterface/oai-nrf:develop',
            'PCF': 'ghcr.io/openairinterface/oai-pcf:develop',
            'NSSF': 'ghcr.io/openairinterface/oai-nssf:develop',
            'MySQL': 'ghcr.io/openairinterface/mysql:8.0',
            'ext-dn': 'ghcr.io/openairinterface/trf-gen-cn5g:latest',
            'gNB': 'ghcr.io/openairinterface/oai-gnb:develop',
            'UE': 'ghcr.io/openairinterface/oai-ue:develop'
        };

        allNFs.forEach((nf, index) => {
            const containerId = this.generateContainerId();
            const serviceName = serviceNameMap[nf.type] || `oai-${nf.type.toLowerCase()}`;
            const image = imageMap[nf.type] || `ghcr.io/openairinterface/oai-${nf.type.toLowerCase()}:develop`;
            const status = nf.status === 'stable' ? 'Up (healthy)' : 'Up (starting)';
            const ports = this.getPortsForNF(nf);
            
            // Calculate creation time
            const createdAt = nf.createdAt || nf.statusTimestamp || Date.now();
            const createdTime = this.formatCreationTime(createdAt);
            
            const line = `${containerId}   ${image.padEnd(45)} "${serviceName}"   ${createdTime.padEnd(13)} ${status.padEnd(20)} ${ports.padEnd(55)} ${serviceName}`;
            this.addTerminalLine(output, line, nf.status === 'stable' ? 'success' : 'warning');
        });
    }

    /**
     * Start watch mode for docker compose ps -a
     * @param {HTMLElement} output - Output element
     */
    startWatch(output) {
        if (this.isWatching) {
            this.addTerminalLine(output, 'Watch mode is already running. Use Ctrl+C to stop.', 'warning');
            return;
        }

        this.isWatching = true;
        this.addTerminalLine(output, 'Starting watch mode (refreshes every 1 second)...', 'info');
        this.addTerminalLine(output, 'Press Ctrl+C to stop watching', 'info');
        this.addTerminalLine(output, '', 'blank');

        // Store initial content length to know where to clear from
        const initialLength = output.querySelectorAll('.docker-terminal-line').length;

        // Initial display
        this.showDockerComposePS(output);

        // Refresh every 1 second
        this.watchInterval = setInterval(() => {
            // Remove all lines added after the initial watch start message
            const allLines = output.querySelectorAll('.docker-terminal-line');
            const linesToRemove = Array.from(allLines).slice(initialLength);
            linesToRemove.forEach(line => line.remove());

            // Add fresh output
            this.showDockerComposePS(output);
        }, 1000);
    }

    /**
     * Stop watch mode
     */
    stopWatch() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
            this.isWatching = false;
        }
    }

    /**
     * Show docker compose ps -a output
     * @param {HTMLElement} output - Output element
     */
    showDockerComposePS(output) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const timestamp = new Date().toLocaleString();

        // Header with timestamp
        this.addTerminalLine(output, `Every 1.0s: docker compose -f docker-compose.yml ps -a`, 'info');
        this.addTerminalLine(output, `Timestamp: ${timestamp}`, 'info');
        this.addTerminalLine(output, '', 'blank');

        if (allNFs.length === 0) {
            this.addTerminalLine(output, 'No services found.', 'info');
            return;
        }

        // Table header
        this.addTerminalLine(output, 'NAME         IMAGE                                     COMMAND                  SERVICE              CREATED              STATUS                        PORTS', 'info');
        this.addTerminalLine(output, '════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════', 'info');

        // Service name map
        const serviceNameMap = {
            'AMF': 'oai-amf',
            'SMF': 'oai-smf',
            'UPF': 'oai-upf',
            'AUSF': 'oai-ausf',
            'UDM': 'oai-udm',
            'UDR': 'oai-udr',
            'NRF': 'oai-nrf',
            'PCF': 'oai-pcf',
            'NSSF': 'oai-nssf',
            'MySQL': 'mysql',
            'ext-dn': 'ext-dn',
            'gNB': 'oai-gnb',
            'UE': 'oai-ue'
        };

        const imageMap = {
            'AMF': 'oaisoftwarealliance/oai-amf:2024-june',
            'SMF': 'oaisoftwarealliance/oai-smf:2024-june',
            'UPF': 'oaisoftwarealliance/oai-upf:2024-june',
            'AUSF': 'oaisoftwarealliance/oai-ausf:2024-june',
            'UDM': 'oaisoftwarealliance/oai-udm:2024-june',
            'UDR': 'oaisoftwarealliance/oai-udr:2024-june',
            'NRF': 'oaisoftwarealliance/oai-nrf:2024-june',
            'PCF': 'oaisoftwarealliance/oai-pcf:2024-june',
            'NSSF': 'oaisoftwarealliance/oai-nssf:2024-june',
            'MySQL': 'mysql:8.0',
            'ext-dn': 'oaisoftwarealliance/trf-gen-cn5g:latest',
            'gNB': 'oaisoftwarealliance/oai-gnb:2024-june',
            'UE': 'oaisoftwarealliance/oai-ue:2024-june'
        };

        allNFs.forEach(nf => {
            const serviceName = serviceNameMap[nf.type] || `oai-${nf.type.toLowerCase()}`;
            const image = imageMap[nf.type] || `oaisoftwarealliance/oai-${nf.type.toLowerCase()}:2024-june`;
            
            // Calculate creation time
            const createdAt = nf.createdAt || nf.statusTimestamp || Date.now();
            const created = this.formatCreationTimeForWatch(createdAt);
            const status = nf.status === 'stable' 
                ? `Up ${created} (healthy)` 
                : `Up ${created} (starting)`;
            const ports = this.getPortsForNF(nf);

            const statusColor = nf.status === 'stable' ? 'success' : 'warning';
            const statusIcon = nf.status === 'stable' ? '🟢' : '🔴';

            const line = `${serviceName.padEnd(12)} ${image.padEnd(38)} "${serviceName}"   ${serviceName.padEnd(15)} ${created.padEnd(20)} ${status.padEnd(28)} ${ports}`;
            this.addTerminalLine(output, `${statusIcon} ${line}`, statusColor);
        });
    }

    /**
     * Execute docker compose down (stop and remove all services)
     * @param {HTMLElement} output - Output element
     */
    async dockerComposeDown(output) {
        const allNFs = window.dataStore?.getAllNFs() || [];

        if (allNFs.length === 0) {
            this.addTerminalLine(output, 'No services to stop.', 'info');
            return;
        }

        // Collect all NF IDs first (before deletion to avoid iteration issues)
        const nfIds = allNFs.map(nf => ({ id: nf.id, name: nf.name, type: nf.type }));

        // Show Docker Compose style output
        this.addTerminalLine(output, `[+] Running ${nfIds.length + 1}/${nfIds.length + 1}`, 'info');

        // Stop and remove each service
        for (const nfInfo of nfIds) {
            // Get service name
            const serviceNameMap = {
                'AMF': 'oai-amf', 'SMF': 'oai-smf', 'UPF': 'oai-upf', 'AUSF': 'oai-ausf',
                'UDM': 'oai-udm', 'UDR': 'oai-udr', 'NRF': 'oai-nrf', 'PCF': 'oai-pcf',
                'NSSF': 'oai-nssf', 'MySQL': 'mysql', 'ext-dn': 'oai-ext-dn'
            };
            const serviceName = serviceNameMap[nfInfo.type] || nfInfo.type.toLowerCase();
            
            // Random delay between 0.8s and 2.3s
            const randomDelay = (Math.random() * 1.5 + 0.8).toFixed(1); // 0.8s to 2.3s
            
            this.addTerminalLine(output, ` ✔ Container ${serviceName.padEnd(16)} Removed${' '.repeat(20)}${randomDelay}s`, 'success');
            await this.delay(parseFloat(randomDelay) * 1000); // Convert to milliseconds
            
            // Actually remove the NF (this also removes connections)
            if (window.nfManager) {
                window.nfManager.deleteNetworkFunction(nfInfo.id);
            } else if (window.dataStore) {
                // Fallback: use dataStore directly
                window.dataStore.removeNF(nfInfo.id);
            }
        }

        // Also clear buses and bus connections
        if (window.dataStore) {
            const allBuses = window.dataStore.getAllBuses() || [];
            const allBusConnections = window.dataStore.getAllBusConnections() || [];
            
            if (allBuses.length > 0 || allBusConnections.length > 0) {
                // Collect IDs first before deletion
                const busConnectionIds = allBusConnections.map(bc => bc.id);
                const busIds = allBuses.map(bus => bus.id);
                
                // Remove bus connections
                busConnectionIds.forEach(busConnId => {
                    window.dataStore.removeBusConnection(busConnId);
                });
                
                // Remove buses
                busIds.forEach(busId => {
                    window.dataStore.removeBus(busId);
                });
            }
        }

        // Remove network
        this.addTerminalLine(output, ` ✔ Network oaiworkshop Removed${' '.repeat(20)}0.2s`, 'success');
        this.oaiWorkshopNetworkExists = false;
        this.oaiWorkshopCreatedTime = null;
        this.addTerminalLine(output, '', 'blank');

        // Re-render canvas
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Execute docker compose down for a single service (e.g. docker compose -f docker-compose.yml down oai-nrf)
     * @param {string} serviceName - Service name (e.g., oai-nrf, oai-amf, mysql)
     * @param {HTMLElement} output - Output element
     */
    async dockerComposeDownSingleNF(serviceName, output) {
        if (!serviceName) {
            this.addTerminalLine(output, 'Usage: docker compose -f docker-compose.yml down <service-name>', 'error');
            return;
        }

        const serviceToNFTypeMap = {
            'oai-nrf': 'NRF', 'oai-amf': 'AMF', 'oai-smf': 'SMF', 'oai-upf': 'UPF',
            'oai-ausf': 'AUSF', 'oai-udm': 'UDM', 'oai-udr': 'UDR', 'oai-pcf': 'PCF',
            'oai-nssf': 'NSSF', 'mysql': 'MySQL', 'oai-ext-dn': 'ext-dn',
            'oai-gnb': 'gNB', 'oai-ue': 'UE'
        };

        const nfType = serviceToNFTypeMap[serviceName.toLowerCase()];
        if (!nfType) {
            this.addTerminalLine(output, `Error: Unknown service '${serviceName}'`, 'error');
            this.addTerminalLine(output, 'Available: oai-nrf, oai-amf, oai-smf, oai-upf, oai-ausf, oai-udm, oai-udr, oai-pcf, oai-nssf, mysql, oai-ext-dn', 'info');
            return;
        }

        const allNFs = window.dataStore?.getAllNFs() || [];
        const nf = allNFs.find(n => n.type === nfType);

        if (!nf) {
            this.addTerminalLine(output, `No such service: ${serviceName}`, 'error');
            this.addTerminalLine(output, `Service '${serviceName}' is not running.`, 'info');
            return;
        }

        this.addTerminalLine(output, `[+] Running 1/1`, 'info');
        const randomDelay = (Math.random() * 0.5 + 0.3).toFixed(1);
        this.addTerminalLine(output, ` ✔ Container ${serviceName.padEnd(16)} Removed${' '.repeat(20)}${randomDelay}s`, 'success');
        await this.delay(parseFloat(randomDelay) * 1000);

        if (window.nfManager) {
            window.nfManager.deleteNetworkFunction(nf.id);
        } else if (window.dataStore) {
            window.dataStore.removeNF(nf.id);
        }

        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, `✅ Stopped and removed ${serviceName}`, 'success');

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Start a specific service
     * @param {string} serviceName - Service name to start
     * @param {HTMLElement} output - Output element
     */
    async dockerStart(serviceName, output) {
        if (!serviceName) {
            this.addTerminalLine(output, 'Usage: docker start <service-name>', 'error');
            return;
        }

        // Find NF by service name
        const allNFs = window.dataStore?.getAllNFs() || [];
        const serviceNameMap = {
            'oai-amf': 'AMF',
            'oai-smf': 'SMF',
            'oai-upf': 'UPF',
            'oai-ausf': 'AUSF',
            'oai-udm': 'UDM',
            'oai-udr': 'UDR',
            'oai-nrf': 'NRF',
            'oai-pcf': 'PCF',
            'oai-nssf': 'NSSF',
            'mysql': 'MySQL',
            'ext-dn': 'ext-dn',
            'oai-gnb': 'gNB',
            'oai-ue': 'UE'
        };

        const nfType = serviceNameMap[serviceName.toLowerCase()];
        const nf = allNFs.find(n => n.type === nfType);

        if (!nf) {
            this.addTerminalLine(output, `Service '${serviceName}' not found.`, 'error');
            return;
        }

        this.addTerminalLine(output, `Starting ${nf.name}...`, 'info');
        
        // Set creation timestamp if not already set
        if (!nf.createdAt) {
            nf.createdAt = Date.now();
        }
        
        nf.status = 'starting';
        nf.statusTimestamp = Date.now();
        window.dataStore.updateNF(nf.id, nf);

        // After 5 seconds, set to stable and (if UPF) auto-connect SMF and ext-dn
        setTimeout(() => {
            const updatedNF = window.dataStore?.getNFById(nf.id);
            if (updatedNF) {
                updatedNF.status = 'stable';
                updatedNF.statusTimestamp = Date.now();
                window.dataStore.updateNF(updatedNF.id, updatedNF);
                if (updatedNF.type === 'UPF') {
                    window.dockerTerminal.autoConnectUPFToSMFAndExtDn(updatedNF);
                }
                if (window.canvasRenderer) window.canvasRenderer.render();
            }
        }, 5000);

        this.addTerminalLine(output, `✅ ${nf.name} started (status: starting)`, 'success');
        this.addTerminalLine(output, 'Service will be stable in ~5 seconds', 'info');

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Stop a specific service
     * @param {string} serviceName - Service name to stop
     * @param {HTMLElement} output - Output element
     */
    async dockerStop(serviceName, output) {
        if (!serviceName) {
            this.addTerminalLine(output, 'Usage: docker stop <service-name>', 'error');
            return;
        }

        // Find NF by service name
        const allNFs = window.dataStore?.getAllNFs() || [];
        const serviceNameMap = {
            'oai-amf': 'AMF',
            'oai-smf': 'SMF',
            'oai-upf': 'UPF',
            'oai-ausf': 'AUSF',
            'oai-udm': 'UDM',
            'oai-udr': 'UDR',
            'oai-nrf': 'NRF',
            'oai-pcf': 'PCF',
            'oai-nssf': 'NSSF',
            'mysql': 'MySQL',
            'ext-dn': 'ext-dn',
            'oai-gnb': 'gNB',
            'oai-ue': 'UE'
        };

        const nfType = serviceNameMap[serviceName.toLowerCase()];
        const nf = allNFs.find(n => n.type === nfType);

        if (!nf) {
            this.addTerminalLine(output, `Service '${serviceName}' not found.`, 'error');
            return;
        }

        this.addTerminalLine(output, `Stopping ${nf.name}...`, 'info');
        
        nf.status = 'stopped';
        nf.statusTimestamp = Date.now();
        window.dataStore.updateNF(nf.id, nf);

        this.addTerminalLine(output, `✅ ${nf.name} stopped`, 'success');

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Add line to terminal output
     * @param {HTMLElement} output - Output element
     * @param {string} text - Text to add
     * @param {string} type - Line type (command, info, error, success, warning, blank)
     */
    addTerminalLine(output, text, type = 'normal') {
        const line = document.createElement('div');
        line.className = `docker-terminal-line docker-terminal-${type}`;
        line.innerHTML = text || '&nbsp;';
        output.appendChild(line);
        
        // Auto-scroll to bottom
        output.scrollTop = output.scrollHeight;
    }

    /**
     * Generate container ID
     * @returns {string} Random container ID
     */
    generateContainerId() {
        const chars = '0123456789abcdef';
        let id = '';
        for (let i = 0; i < 12; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    /**
     * Get ports for NF
     * @param {Object} nf - Network Function
     * @returns {string} Ports string
     */
    getPortsForNF(nf) {
        const portMap = {
            'AMF': '80/tcp, 8080/tcp, 9090/tcp, 38412/sctp',
            'SMF': '80/tcp, 8080/tcp, 8805/udp',
            'UPF': '2152/udp, 8805/udp',
            'AUSF': '80/tcp, 8080/tcp',
            'UDM': '80/tcp, 8080/tcp',
            'UDR': '80/tcp, 8080/tcp',
            'NRF': '80/tcp, 8080/tcp, 9090/tcp',
            'PCF': '80/tcp, 8080/tcp',
            'NSSF': '80/tcp, 8080/tcp',
            'MySQL': '3306/tcp, 33060/tcp',
            'gNB': '2152/udp, 38412/sctp',
            'UE': '2152/udp'
        };

        return portMap[nf.type] || `${nf.config.port}/tcp`;
    }

    /**
     * Create default NFs as fallback
     * @param {HTMLElement} output - Output element
     */
    async createDefaultNFs(output) {
        const defaultNFs = this.getDefaultNFConfigurations();
        const creationTime = Date.now();
        
        for (const nfConfig of defaultNFs) {
            this.addTerminalLine(output, `Creating ${nfConfig.type}...`, 'info');
            
            // Calculate position for the NF
            const position = window.nfManager.calculateAutoPosition(nfConfig.type, 1);
            
            // Create NF using NFManager
            const nf = window.nfManager.createNetworkFunction(nfConfig.type, position);
            
            if (nf) {
                // Override with default configuration
                nf.config.ipAddress = nfConfig.ipAddress;
                nf.config.port = nfConfig.port;
                nf.config.httpProtocol = nfConfig.httpProtocol || 'HTTP/2';
                
                // Set creation timestamp
                nf.createdAt = creationTime;
                
                // Update in data store
                window.dataStore.updateNF(nf.id, nf);
                
                this.addTerminalLine(output, `✅ ${nf.name} created (${nfConfig.ipAddress}:${nfConfig.port})`, 'success');
                await this.delay(200); // Small delay between creations
            }
        }
        
        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, `✅ Created ${defaultNFs.length} default Network Functions`, 'success');
    }

    /**
     * Filter topology to exclude gNB and UE, and remove direct connections between Service Bus NFs
     * @param {Object} topology - Topology object
     * @returns {Object} Filtered topology
     */
    filterTopology(topology) {
        const filtered = JSON.parse(JSON.stringify(topology)); // Deep clone
        
        // Filter NFs - exclude gNB and UE
        if (filtered.nfs && Array.isArray(filtered.nfs)) {
            filtered.nfs = filtered.nfs.filter(nf => 
                nf.type !== 'gNB' && nf.type !== 'UE'
            );
        }
        
        // Get all NF IDs connected to Service Bus
        const serviceBusNFIds = new Set();
        if (filtered.buses && Array.isArray(filtered.buses)) {
            filtered.buses.forEach(bus => {
                if (bus.connections && Array.isArray(bus.connections)) {
                    bus.connections.forEach(nfId => {
                        serviceBusNFIds.add(nfId);
                    });
                }
            });
        }
        
        // Also get from busConnections
        if (filtered.busConnections && Array.isArray(filtered.busConnections)) {
            filtered.busConnections.forEach(busConn => {
                serviceBusNFIds.add(busConn.nfId);
            });
        }
        
        // Filter connections - remove:
        // 1. Connections involving gNB or UE
        // 2. Direct connections between NFs that are both on the Service Bus
        if (filtered.connections && Array.isArray(filtered.connections)) {
            const excludedNFIds = new Set();
            if (topology.nfs) {
                topology.nfs.forEach(nf => {
                    if (nf.type === 'gNB' || nf.type === 'UE') {
                        excludedNFIds.add(nf.id);
                    }
                });
            }
            
            filtered.connections = filtered.connections.filter(conn => {
                // Remove connections involving gNB or UE
                if (excludedNFIds.has(conn.sourceId) || excludedNFIds.has(conn.targetId)) {
                    return false;
                }
                
                // Remove direct connections between NFs that are both on Service Bus
                // Keep connections like N4 (UPF-SMF), N6 (ext-dn-UPF), MySQL-UDR
                // These are not Service Bus connections or are different interface types
                const bothOnServiceBus = serviceBusNFIds.has(conn.sourceId) && 
                                        serviceBusNFIds.has(conn.targetId);
                
                if (bothOnServiceBus) {
                    // Check if it's a Service Bus interface (Nnrf, Namf, etc.)
                    const serviceBusInterfaces = [
                        'Nnrf_NFManagement', 'Nnrf_NFDiscovery', 'Nnrf',
                        'Namf', 'Nsmf', 'Nausf', 'Nudm', 'Npcf', 'Nnssf', 'Nudr'
                    ];
                    
                    const isServiceBusInterface = serviceBusInterfaces.some(iface => 
                        conn.interfaceName?.includes(iface) || conn.interfaceName === iface
                    );
                    
                    // Remove if it's a Service Bus interface connection
                    if (isServiceBusInterface) {
                        return false;
                    }
                }
                
                return true;
            });
        }
        
        // Filter bus connections - remove bus connections for gNB and UE
        if (filtered.busConnections && Array.isArray(filtered.busConnections)) {
            const excludedNFIds = new Set();
            if (topology.nfs) {
                topology.nfs.forEach(nf => {
                    if (nf.type === 'gNB' || nf.type === 'UE') {
                        excludedNFIds.add(nf.id);
                    }
                });
            }
            
            filtered.busConnections = filtered.busConnections.filter(busConn => 
                !excludedNFIds.has(busConn.nfId)
            );
        }
        
        // Update bus connections list
        if (filtered.buses && Array.isArray(filtered.buses)) {
            filtered.buses.forEach(bus => {
                if (bus.connections && Array.isArray(bus.connections)) {
                    const excludedNFIds = new Set();
                    if (topology.nfs) {
                        topology.nfs.forEach(nf => {
                            if (nf.type === 'gNB' || nf.type === 'UE') {
                                excludedNFIds.add(nf.id);
                            }
                        });
                    }
                    bus.connections = bus.connections.filter(nfId => !excludedNFIds.has(nfId));
                }
            });
        }
        
        return filtered;
    }

    /**
     * When UPF becomes stable (after 5s), auto-create SMF and ext-dn if missing and connect:
     * N4: UPF -> SMF, N6: ext-dn -> UPF
     * @param {Object} upf - The UPF NF object (must have upf.id)
     */
    async autoConnectUPFToSMFAndExtDn(upf) {
        if (!upf || upf.type !== 'UPF' || !window.dataStore) return;

        let topology = null;
        try {
            const response = await fetch('../one-click.json');
            if (response.ok) topology = this.filterTopology(await response.json());
        } catch (e) {
            console.warn('autoConnectUPFToSMFAndExtDn: failed to load topology', e);
        }

        const defs = this.getDefaultNFConfigurations();
        const allNFs = window.dataStore.getAllNFs() || [];
        const hasSMF = allNFs.some(n => n.type === 'SMF');
        const hasExtDn = allNFs.some(n => n.type === 'ext-dn');

        const addConnection = (sourceId, targetId, interfaceName) => {
            const exists = (window.dataStore.getAllConnections() || []).some(
                c => (c.sourceId === sourceId && c.targetId === targetId) || (c.sourceId === targetId && c.targetId === sourceId)
            );
            if (exists) return;
            const conn = {
                id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                sourceId, targetId, interfaceName,
                protocol: 'HTTP/2', status: 'connected', createdAt: Date.now(),
                isManual: false, showVisual: true
            };
            window.dataStore.addConnection(conn);
        };

        const createNFFromTopology = (type, defaultConfig) => {
            const topoNF = topology?.nfs?.find(n => n.type === type);
            const posX = topoNF?.position?.x ?? topoNF?.x ?? 100;
            const posY = topoNF?.position?.y ?? topoNF?.y ?? 100;
            const cfg = defaultConfig || defs.find(c => c.type === type);
            const nf = {
                id: topoNF?.id || `nf-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type, name: topoNF?.name || `${type}-1`,
                position: { x: posX, y: posY },
                color: topoNF?.color || '#00bcd4',
                config: { ipAddress: cfg?.ipAddress || '192.168.1.12', port: cfg?.port || 8080, httpProtocol: 'HTTP/2', capacity: 1000, load: 0 },
                icon: topoNF?.icon || (type === 'SMF' ? 'images/icons/smf.svg' : null),
                createdAt: Date.now(), status: 'stable', statusTimestamp: Date.now()
            };
            if (type === 'ext-dn') nf.config.port = 80;
            window.dataStore.addNF(nf);
            if (nf.icon && type === 'SMF') {
                const img = new Image();
                img.src = new URL(nf.icon.startsWith('http') ? nf.icon : nf.icon, window.location.href).href;
                img.onload = () => { nf.iconImage = img; if (window.canvasRenderer) window.canvasRenderer.render(); };
                img.onerror = () => { img.src = new URL('images/icons/smf.svg', window.location.href).href; };
            }
            if (window.logEngine) window.logEngine.onNFAdded(nf);
            return nf;
        };

        let smf = allNFs.find(n => n.type === 'SMF');
        if (!hasSMF) {
            const smfCfg = defs.find(c => c.type === 'SMF');
            smf = createNFFromTopology('SMF', smfCfg);
        }

        let extDn = allNFs.find(n => n.type === 'ext-dn');
        if (!hasExtDn) {
            const extDnCfg = { type: 'ext-dn', ipAddress: '192.168.1.15', port: 80, httpProtocol: 'HTTP/2' };
            extDn = createNFFromTopology('ext-dn', extDnCfg);
        }

        addConnection(upf.id, smf.id, 'N4');
        addConnection(extDn.id, upf.id, 'N6');

        if (window.canvasRenderer) window.canvasRenderer.render();
    }

    /**
     * Remove all buses and all bus connections from the data store (clears the older bus line).
     */
    removeAllBusesAndBusConnections() {
        if (!window.dataStore) return;
        const busConnections = window.dataStore.getAllBusConnections() || [];
        busConnections.forEach(conn => window.dataStore.removeBusConnection(conn.id));
        const buses = window.dataStore.getAllBuses() || [];
        buses.forEach(bus => window.dataStore.removeBus(bus.id));
    }

    /**
     * Ensure an NF is connected to the Service Bus from topology (so the line shows on canvas).
     * Creates the bus if missing and adds the bus connection for this NF.
     * @param {Object} nf - The NF just added (must have nf.id)
     * @param {Object} filteredTopology - Filtered topology with buses and busConnections
     */
    ensureNFConnectedToBus(nf, filteredTopology) {
        if (!window.dataStore || !nf || !nf.id || !filteredTopology) return;
        const busConnections = filteredTopology.busConnections || [];
        const buses = filteredTopology.buses || [];
        const topologyNFs = filteredTopology.nfs || [];
        // Match by id (topology-created NF) or by type (fallback-created NF from batch)
        const connsForThisNF = busConnections.filter(bc => {
            if (bc.nfId === nf.id) return true;
            const topoNF = topologyNFs.find(n => n.id === bc.nfId);
            return topoNF && topoNF.type === nf.type;
        });
        if (connsForThisNF.length === 0) return;

        for (const busConn of connsForThisNF) {
            const bus = buses.find(b => b.id === busConn.busId);
            if (!bus) continue;

            if (!window.dataStore.getBusById(bus.id)) {
                window.dataStore.addBus(JSON.parse(JSON.stringify(bus)));
            }
            const exists = (window.dataStore.getAllBusConnections() || []).some(
                c => c.nfId === nf.id && c.busId === busConn.busId
            );
            if (!exists) {
                const newConn = {
                    id: busConn.id || `bus-conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    nfId: nf.id,
                    busId: busConn.busId,
                    type: busConn.type || 'bus-connection',
                    interfaceName: busConn.interfaceName,
                    protocol: busConn.protocol || 'HTTP/2',
                    status: busConn.status || 'connected',
                    createdAt: busConn.createdAt || Date.now()
                };
                window.dataStore.addBusConnection(newConn);
            }
        }
    }

    /**
     * Get default NF configurations for one-click deployment
     * @returns {Array} Array of default NF configurations
     */
    getDefaultNFConfigurations() {
        return [
            { type: 'NRF', ipAddress: '192.168.1.10', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'AMF', ipAddress: '192.168.1.20', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'SMF', ipAddress: '192.168.1.30', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'UPF', ipAddress: '192.168.1.40', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'AUSF', ipAddress: '192.168.1.50', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'UDM', ipAddress: '192.168.1.60', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'UDR', ipAddress: '192.168.1.70', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'PCF', ipAddress: '192.168.1.80', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'NSSF', ipAddress: '192.168.1.90', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'MySQL', ipAddress: '192.168.1.100', port: 3306, httpProtocol: 'HTTP/2' }
        ];
    }

    /**
     * Execute docker compose up -d for a single NF
     * @param {string} serviceName - Service name (e.g., oai-nrf, oai-amf)
     * @param {HTMLElement} output - Output element
     */
    async dockerComposeUpSingleNF(serviceName, output) {
        console.log('🔧 dockerComposeUpSingleNF called with:', serviceName);
        
        // Map service names to NF types
        const serviceToNFTypeMap = {
            'oai-nrf': 'NRF',
            'oai-amf': 'AMF',
            'oai-smf': 'SMF',
            'oai-upf': 'UPF',
            'oai-ausf': 'AUSF',
            'oai-udm': 'UDM',
            'oai-udr': 'UDR',
            'oai-pcf': 'PCF',
            'oai-nssf': 'NSSF',
            'mysql': 'MySQL',
            'oai-ext-dn': 'ext-dn',
            'oai-gnb': 'gNB',
            'oai-ue': 'UE'
        };

        const nfType = serviceToNFTypeMap[serviceName.toLowerCase()];
        console.log('🔧 Mapped to NF type:', nfType);
        
        if (!nfType) {
            this.addTerminalLine(output, `Error: Unknown service '${serviceName}'`, 'error');
            this.addTerminalLine(output, 'Available services: oai-nrf, oai-amf, oai-smf, oai-upf, oai-ausf, oai-udm, oai-udr, oai-pcf, oai-nssf, mysql', 'info');
            return;
        }

        // Check if dataStore and nfManager are available
        if (!window.dataStore || !window.nfManager) {
            this.addTerminalLine(output, 'Error: System not initialized. Please refresh the page.', 'error');
            return;
        }

        // Check if this NF already exists
        const allNFs = window.dataStore.getAllNFs();
        const existingNF = allNFs.find(nf => nf.type === nfType);
        
        if (existingNF) {
            this.addTerminalLine(output, `Error: ${nfType} already exists!`, 'error');
            this.addTerminalLine(output, `Container ${serviceName} is already running.`, 'info');
            return;
        }

        // Create network if this is the first NF
        const isFirstNF = allNFs.length === 0;
        
        if (isFirstNF) {
            this.addTerminalLine(output, `[+] Running 2/2`, 'info');
            this.addTerminalLine(output, ' ✔ Network oaiworkshop Created' + ' '.repeat(20) + '0.2s', 'success');
            this.oaiWorkshopNetworkExists = true;
            this.oaiWorkshopCreatedTime = Date.now();
            await this.delay(200);
        } else {
            this.addTerminalLine(output, `[+] Running 1/1`, 'info');
        }

        console.log('🔧 Loading topology from one-click.json...');
        
        // Load topology from one-click.json to get proper position, bus, and bus connections
        let topologyNF = null;
        let filteredTopology = null;
        try {
            const response = await fetch('../one-click.json');
            if (response.ok) {
                const topology = await response.json();
                filteredTopology = this.filterTopology(topology);
                
                if (filteredTopology.nfs && Array.isArray(filteredTopology.nfs)) {
                    topologyNF = filteredTopology.nfs.find(nf => nf.type === nfType);
                    console.log('🔧 Found NF in topology:', topologyNF);
                }
            }
        } catch (error) {
            console.warn('Failed to load topology for NF positioning:', error);
        }

        // Create the NF with topology data if available (canvas expects nf.position.x / nf.position.y)
        let nf;
        if (topologyNF) {
            const posX = topologyNF.position?.x ?? topologyNF.x ?? 100;
            const posY = topologyNF.position?.y ?? topologyNF.y ?? 100;
            // Use topology data for position and configuration
            nf = {
                id: topologyNF.id || `nf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: nfType,
                name: topologyNF.name || nfType,
                position: { x: posX, y: posY },
                color: topologyNF.color,
                config: {
                    ipAddress: topologyNF.config?.ipAddress || this.getDefaultNFConfigurations().find(c => c.type === nfType)?.ipAddress,
                    port: topologyNF.config?.port || this.getDefaultNFConfigurations().find(c => c.type === nfType)?.port,
                    httpProtocol: topologyNF.config?.httpProtocol || 'HTTP/2',
                    capacity: topologyNF.config?.capacity || 1000,
                    load: topologyNF.config?.load || 0
                },
                icon: topologyNF.icon,
                createdAt: Date.now(),
                status: 'starting',
                statusTimestamp: Date.now()
            };
            
            console.log('🚀 Creating NF from topology:', nf);
            
            // Add to dataStore
            window.dataStore.addNF(nf);
            
            // Immediately render canvas to show NF (canvas uses nf.position)
            if (window.canvasRenderer) {
                window.canvasRenderer.render();
                console.log('✅ Canvas rendered after adding NF');
            }
            
            // Load icon image (resolve path relative to current page like NFManager)
            if (nf.icon) {
                const img = new Image();
                const iconPath = nf.icon.startsWith('http') ? nf.icon : nf.icon;
                img.src = new URL(iconPath, window.location.href).href;
                img.onload = () => {
                    nf.iconImage = img;
                    console.log('✅ Icon loaded for', nf.name);
                    if (window.canvasRenderer) window.canvasRenderer.render();
                };
                img.onerror = () => {
                    const fallback = `images/icons/${nf.type.toLowerCase()}.svg`;
                    img.src = new URL(fallback, window.location.href).href;
                    img.onerror = () => console.warn(`Failed to load icon for ${nf.name}`);
                };
            }
            
            // Trigger log engine
            if (window.logEngine) {
                window.logEngine.onNFAdded(nf);
            }

            // Remove older bus line, then reconnect ALL current NFs (including this one) to a fresh bus
            if (filteredTopology && window.dataStore) {
                this.removeAllBusesAndBusConnections();
                const allCurrentNFs = window.dataStore.getAllNFs() || [];
                allCurrentNFs.forEach(existingNF => this.ensureNFConnectedToBus(existingNF, filteredTopology));
                if (window.canvasRenderer) window.canvasRenderer.render();
            }
        } else {
            // Fallback: Use default positioning
            const defaultConfig = this.getDefaultNFConfigurations().find(cfg => cfg.type === nfType);
            const position = window.nfManager.calculateAutoPosition(nfType, allNFs.length + 1);
            
            nf = window.nfManager.createNetworkFunction(nfType, position);
            
            if (!nf) {
                this.addTerminalLine(output, `Error: Failed to create ${nfType}`, 'error');
                return;
            }

            // Apply default configuration
            nf.config.ipAddress = defaultConfig.ipAddress;
            nf.config.port = defaultConfig.port;
            nf.config.httpProtocol = defaultConfig.httpProtocol || 'HTTP/2';
            nf.createdAt = Date.now();
            nf.status = 'starting';
            nf.statusTimestamp = Date.now();
            
            window.dataStore.updateNF(nf.id, nf);
        }

        // Show container creation with timing
        const randomDelay = (Math.random() * 1.5 + 0.8).toFixed(1);
        this.addTerminalLine(output, ` ✔ Container ${serviceName.padEnd(16)} Started${' '.repeat(20)}${randomDelay}s`, 'success');
        await this.delay(parseFloat(randomDelay) * 1000);

        // Generate startup log
        if (window.logEngine) {
            window.logEngine.addLog(nf.id, 'INFO', 
                `${nf.name} starting via docker compose`, {
                ipAddress: nf.config.ipAddress,
                port: nf.config.port,
                protocol: nf.config.httpProtocol,
                status: 'starting',
                source: 'docker-compose'
            });
        }

        // After 5 seconds, set to stable and (if UPF) auto-connect SMF and ext-dn
        setTimeout(() => {
            const updatedNF = window.dataStore?.getNFById(nf.id);
            if (updatedNF) {
                updatedNF.status = 'stable';
                updatedNF.statusTimestamp = Date.now();
                if (!updatedNF.createdAt && nf.createdAt) {
                    updatedNF.createdAt = nf.createdAt;
                }
                window.dataStore.updateNF(updatedNF.id, updatedNF);
                
                if (window.logEngine) {
                    window.logEngine.addLog(updatedNF.id, 'SUCCESS', 
                        `${updatedNF.name} is now STABLE and ready for connections`, {
                        previousStatus: 'starting',
                        newStatus: 'stable',
                        uptime: '5 seconds',
                        readyForConnections: true
                    });
                }
                
                if (updatedNF.type === 'UPF') {
                    window.dockerTerminal.autoConnectUPFToSMFAndExtDn(updatedNF);
                }
                
                if (window.canvasRenderer) window.canvasRenderer.render();
            }
        }, 5000);

        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, `✅ ${nfType} deployed successfully on network oaiworkshop (${nf.config.ipAddress})`, 'success');

        // Re-render canvas
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Format creation time for docker ps command
     * @param {number} timestamp - Creation timestamp
     * @returns {string} Formatted time string
     */
    formatCreationTime(timestamp) {
        if (!timestamp) return '3 weeks ago';
        
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) {
            return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
        } else if (minutes < 60) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        } else if (hours < 24) {
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        } else if (days < 7) {
            return `${days} day${days !== 1 ? 's' : ''} ago`;
        } else if (days < 30) {
            const weeks = Math.floor(days / 7);
            return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
        } else {
            const months = Math.floor(days / 30);
            return `${months} month${months !== 1 ? 's' : ''} ago`;
        }
    }

    /**
     * Format creation time for watch command (docker compose ps -a)
     * @param {number} timestamp - Creation timestamp
     * @returns {string} Formatted time string
     */
    formatCreationTimeForWatch(timestamp) {
        if (!timestamp) return 'About a minute ago';
        
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        
        if (seconds < 30) {
            return 'Just now';
        } else if (seconds < 60) {
            return 'About a minute ago';
        } else if (minutes === 1) {
            return 'About a minute ago';
        } else if (minutes < 60) {
            return `About ${minutes} minutes ago`;
        } else {
            const hours = Math.floor(minutes / 60);
            if (hours === 1) {
                return 'About an hour ago';
            } else if (hours < 24) {
                return `About ${hours} hours ago`;
            } else {
                const days = Math.floor(hours / 24);
                if (days === 1) {
                    return 'About a day ago';
                } else {
                    return `About ${days} days ago`;
                }
            }
        }
    }

    /**
     * Delay helper
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Setup window controls (drag, resize, minimize, maximize)
     * @param {HTMLElement} terminalModal - Terminal modal element
     */
    setupWindowControls(terminalModal) {
        const terminalWindow = document.getElementById('docker-terminal-window');
        const titlebar = document.getElementById('docker-terminal-titlebar');
        const minimizeBtn = document.getElementById('docker-terminal-minimize');
        const maximizeBtn = document.getElementById('docker-terminal-maximize');
        const resizeHandle = document.getElementById('docker-terminal-resize-handle');

        if (!terminalWindow || !titlebar) return;

        // Dragging functionality
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let windowStartX = 0;
        let windowStartY = 0;

        titlebar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.docker-terminal-btn')) return; // Don't drag when clicking buttons
            if (this.terminalState.isMaximized) return; // Don't drag when maximized

            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            const rect = terminalWindow.getBoundingClientRect();
            windowStartX = rect.left;
            windowStartY = rect.top;

            titlebar.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;

            const newX = windowStartX + deltaX;
            const newY = windowStartY + deltaY;

            // Keep window within viewport bounds
            const maxX = window.innerWidth - terminalWindow.offsetWidth;
            const maxY = window.innerHeight - terminalWindow.offsetHeight;

            this.terminalState.x = Math.max(0, Math.min(newX, maxX));
            this.terminalState.y = Math.max(0, Math.min(newY, maxY));

            terminalWindow.style.left = this.terminalState.x + 'px';
            terminalWindow.style.top = this.terminalState.y + 'px';
            terminalWindow.style.transform = 'none';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                titlebar.style.cursor = 'grab';
                this.saveTerminalState();
            }
        });

        // Resizing functionality
        let isResizing = false;
        let resizeStartX = 0;
        let resizeStartY = 0;
        let startWidth = 0;
        let startHeight = 0;

        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                if (this.terminalState.isMaximized) return;

                isResizing = true;
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                startWidth = terminalWindow.offsetWidth;
                startHeight = terminalWindow.offsetHeight;

                e.preventDefault();
                e.stopPropagation();
            });
        }

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaX = e.clientX - resizeStartX;
            const deltaY = e.clientY - resizeStartY;

            const newWidth = Math.max(400, Math.min(startWidth + deltaX, window.innerWidth - 100));
            const newHeight = Math.max(300, Math.min(startHeight + deltaY, window.innerHeight - 100));

            this.terminalState.width = newWidth;
            this.terminalState.height = newHeight;

            terminalWindow.style.width = newWidth + 'px';
            terminalWindow.style.height = newHeight + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                this.saveTerminalState();
            }
        });

        // Minimize button
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                this.minimizeTerminal(terminalWindow);
            });
        }

        // Maximize button
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => {
                this.toggleMaximize(terminalWindow);
            });
        }

        // Double-click titlebar to maximize/restore
        titlebar.addEventListener('dblclick', (e) => {
            if (e.target.closest('.docker-terminal-btn')) return;
            this.toggleMaximize(terminalWindow);
        });

        // Set cursor for titlebar
        titlebar.style.cursor = 'grab';
    }

    /**
     * Minimize terminal window
     * @param {HTMLElement} terminalWindow - Terminal window element
     */
    minimizeTerminal(terminalWindow) {
        this.terminalState.isMinimized = !this.terminalState.isMinimized;

        if (this.terminalState.isMinimized) {
            // Just hide the content, don't remove it
            terminalWindow.style.height = '35px';
            const content = document.getElementById('docker-terminal-content');
            if (content) content.style.display = 'none';
            const resizeHandle = document.getElementById('docker-terminal-resize-handle');
            if (resizeHandle) resizeHandle.style.display = 'none';
        } else {
            // Restore the content
            terminalWindow.style.height = this.terminalState.height + 'px';
            const content = document.getElementById('docker-terminal-content');
            if (content) content.style.display = 'flex';
            const resizeHandle = document.getElementById('docker-terminal-resize-handle');
            if (resizeHandle) resizeHandle.style.display = 'block';
        }

        this.saveTerminalState();
    }

    /**
     * Toggle maximize/restore terminal window
     * @param {HTMLElement} terminalWindow - Terminal window element
     */
    toggleMaximize(terminalWindow) {
        this.terminalState.isMaximized = !this.terminalState.isMaximized;
        const maximizeBtn = document.getElementById('docker-terminal-maximize');

        if (this.terminalState.isMaximized) {
            // Save current position before maximizing
            if (!terminalWindow.style.left) {
                const rect = terminalWindow.getBoundingClientRect();
                this.terminalState.x = rect.left;
                this.terminalState.y = rect.top;
            }

            terminalWindow.style.left = '0';
            terminalWindow.style.top = '0';
            terminalWindow.style.width = '100vw';
            terminalWindow.style.height = '100vh';
            terminalWindow.style.transform = 'none';
            terminalWindow.style.borderRadius = '0';

            if (maximizeBtn) maximizeBtn.textContent = '❐';
        } else {
            // Restore previous position and size
            terminalWindow.style.width = this.terminalState.width + 'px';
            terminalWindow.style.height = this.terminalState.height + 'px';
            terminalWindow.style.borderRadius = '8px 8px 0 0';

            if (this.terminalState.x !== null && this.terminalState.y !== null) {
                terminalWindow.style.left = this.terminalState.x + 'px';
                terminalWindow.style.top = this.terminalState.y + 'px';
                terminalWindow.style.transform = 'none';
            } else {
                terminalWindow.style.left = '';
                terminalWindow.style.top = '';
                terminalWindow.style.transform = '';
            }

            if (maximizeBtn) maximizeBtn.textContent = '□';
        }

        this.saveTerminalState();
    }

    /**
     * Apply saved terminal state
     */
    applyTerminalState() {
        const terminalWindow = document.getElementById('docker-terminal-window');
        if (!terminalWindow) return;

        // Load saved state from localStorage
        const savedState = localStorage.getItem('dockerTerminalState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                this.terminalState = { ...this.terminalState, ...state };
            } catch (e) {
                console.warn('Failed to load terminal state:', e);
            }
        }

        // Apply size
        terminalWindow.style.width = this.terminalState.width + 'px';
        terminalWindow.style.height = this.terminalState.height + 'px';

        // Apply position if saved
        if (this.terminalState.x !== null && this.terminalState.y !== null) {
            terminalWindow.style.left = this.terminalState.x + 'px';
            terminalWindow.style.top = this.terminalState.y + 'px';
            terminalWindow.style.transform = 'none';
        }

        // Apply maximized state
        if (this.terminalState.isMaximized) {
            this.toggleMaximize(terminalWindow);
        }

        // Apply minimized state
        if (this.terminalState.isMinimized) {
            this.minimizeTerminal(terminalWindow);
        }
    }

    /**
     * Save terminal state to localStorage
     */
    saveTerminalState() {
        try {
            localStorage.setItem('dockerTerminalState', JSON.stringify(this.terminalState));
        } catch (e) {
            console.warn('Failed to save terminal state:', e);
        }
    }

    /**
     * Docker network ls command
     * @param {HTMLElement} output - Output element
     */
    dockerNetworkLS(output) {
        this.addTerminalLine(output, 'NETWORK ID     NAME          DRIVER    SCOPE', 'info');
        
        // Default networks
        this.addTerminalLine(output, 'df33e4a6502d   bridge        bridge    local', 'info');
        this.addTerminalLine(output, '902c1fcc4369   host          host      local', 'info');
        this.addTerminalLine(output, '0c712814bbb0   none          null      local', 'info');
        
        // OAI workshop network: show when compose has been run (flag set) OR when any NFs exist (simulation state)
        const hasNFs = window.dataStore && window.dataStore.getAllNFs().length > 0;
        if (this.oaiWorkshopNetworkExists || hasNFs) {
            if (!this.oaiWorkshopNetworkExists && hasNFs) {
                this.oaiWorkshopNetworkExists = true;
                this.oaiWorkshopNetworkId = this.oaiWorkshopNetworkId || this.generateNetworkId();
            }
            this.addTerminalLine(output, `${this.oaiWorkshopNetworkId}   oaiworkshop   bridge    local`, 'success');
        }
    }

    /**
     * Docker network inspect command
     * @param {string} networkName - Network name to inspect
     * @param {HTMLElement} output - Output element
     */
    dockerNetworkInspect(networkName, output) {
        if (networkName === 'bridge') {
            this.inspectBridgeNetwork(output);
        } else if (networkName === 'host') {
            this.inspectHostNetwork(output);
        } else if (networkName === 'none') {
            this.inspectNoneNetwork(output);
        } else if (networkName === 'oaiworkshop') {
            if (this.oaiWorkshopNetworkExists) {
                this.inspectOAIWorkshopNetwork(output);
            } else {
                this.addTerminalLine(output, `Error: No such network: ${networkName}`, 'error');
            }
        } else {
            this.addTerminalLine(output, `Error: No such network: ${networkName}`, 'error');
        }
    }

    /**
     * Inspect bridge network
     * @param {HTMLElement} output - Output element
     */
    inspectBridgeNetwork(output) {
        const json = {
            "Name": "bridge",
            "Id": "df33e4a6502d1229e87fbd225ce8cc4b95fd4553fcaadee50fd5a70a4a021f3d",
            "Created": "2026-01-30T15:26:16.417604705+05:30",
            "Scope": "local",
            "Driver": "bridge",
            "EnableIPv4": true,
            "EnableIPv6": false,
            "IPAM": {
                "Driver": "default",
                "Options": null,
                "Config": [
                    {
                        "Subnet": "172.17.0.0/16",
                        "Gateway": "172.17.0.1"
                    }
                ]
            },
            "Internal": false,
            "Attachable": false,
            "Ingress": false,
            "ConfigFrom": {
                "Network": ""
            },
            "ConfigOnly": false,
            "Containers": {},
            "Options": {
                "com.docker.network.bridge.default_bridge": "true",
                "com.docker.network.bridge.enable_icc": "true",
                "com.docker.network.bridge.enable_ip_masquerade": "true",
                "com.docker.network.bridge.host_binding_ipv4": "0.0.0.0",
                "com.docker.network.bridge.name": "docker0",
                "com.docker.network.driver.mtu": "1500"
            },
            "Labels": {}
        };
        
        this.addTerminalLine(output, JSON.stringify([json], null, 2), 'info');
    }

    /**
     * Inspect host network
     * @param {HTMLElement} output - Output element
     */
    inspectHostNetwork(output) {
        const json = {
            "Name": "host",
            "Id": "902c1fcc436950abba5007bd8b39b65ab96fd9c72b3873519ebc55bc14315b74",
            "Created": "2026-01-20T15:04:16.397276602+05:30",
            "Scope": "local",
            "Driver": "host",
            "EnableIPv4": true,
            "EnableIPv6": false,
            "IPAM": {
                "Driver": "default",
                "Options": null,
                "Config": null
            },
            "Internal": false,
            "Attachable": false,
            "Ingress": false,
            "ConfigFrom": {
                "Network": ""
            },
            "ConfigOnly": false,
            "Containers": {},
            "Options": {},
            "Labels": {}
        };
        
        this.addTerminalLine(output, JSON.stringify([json], null, 2), 'info');
    }

    /**
     * Inspect none network
     * @param {HTMLElement} output - Output element
     */
    inspectNoneNetwork(output) {
        const json = {
            "Name": "none",
            "Id": "0c712814bbb0c32a4d2846f885d90534121f472d0c71d0c34330ad6da8327020",
            "Created": "2026-01-20T15:04:16.389588497+05:30",
            "Scope": "local",
            "Driver": "null",
            "EnableIPv4": true,
            "EnableIPv6": false,
            "IPAM": {
                "Driver": "default",
                "Options": null,
                "Config": null
            },
            "Internal": false,
            "Attachable": false,
            "Ingress": false,
            "ConfigFrom": {
                "Network": ""
            },
            "ConfigOnly": false,
            "Containers": {},
            "Options": {},
            "Labels": {}
        };
        
        this.addTerminalLine(output, JSON.stringify([json], null, 2), 'info');
    }

    /**
     * Inspect OAI workshop network
     * @param {HTMLElement} output - Output element
     */
    inspectOAIWorkshopNetwork(output) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const containers = {};
        
        // Build containers object with actual NF IPs
        allNFs.forEach(nf => {
            const serviceNameMap = {
                'AMF': 'oai-amf', 'SMF': 'oai-smf', 'UPF': 'oai-upf', 'AUSF': 'oai-ausf',
                'UDM': 'oai-udm', 'UDR': 'oai-udr', 'NRF': 'oai-nrf', 'PCF': 'oai-pcf',
                'NSSF': 'oai-nssf', 'MySQL': 'mysql', 'ext-dn': 'oai-ext-dn'
            };
            const serviceName = serviceNameMap[nf.type] || nf.type.toLowerCase();
            const containerId = this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + 'abcd';
            
            containers[containerId] = {
                "Name": serviceName,
                "EndpointID": this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + 'ef01',
                "MacAddress": this.generateMacAddress(),
                "IPv4Address": nf.config.ipAddress + "/26",
                "IPv6Address": ""
            };
        });
        
        const createdTime = this.oaiWorkshopCreatedTime ? new Date(this.oaiWorkshopCreatedTime).toISOString() : new Date().toISOString();
        
        const json = {
            "Name": "oaiworkshop",
            "Id": this.oaiWorkshopNetworkId + "d0a87f40b563d8172b3f54045b0da9d9b859ed25522c2aaa8b86",
            "Created": createdTime,
            "Scope": "local",
            "Driver": "bridge",
            "EnableIPv4": true,
            "EnableIPv6": false,
            "IPAM": {
                "Driver": "default",
                "Options": null,
                "Config": [
                    {
                        "Subnet": "192.168.1.0/24",
                        "Gateway": "192.168.1.1"
                    }
                ]
            },
            "Internal": false,
            "Attachable": false,
            "Ingress": false,
            "ConfigFrom": {
                "Network": ""
            },
            "ConfigOnly": false,
            "Containers": containers,
            "Options": {
                "com.docker.network.bridge.name": "oaiworkshop"
            },
            "Labels": {
                "com.docker.compose.config-hash": "dca0e19cf413805e199db52df7a818f82ffd4a571265d5f722c8e2198676da59",
                "com.docker.compose.network": "public_net",
                "com.docker.compose.project": "cn",
                "com.docker.compose.version": "5.0.1"
            }
        };
        
        this.addTerminalLine(output, JSON.stringify([json], null, 2), 'info');
    }

    /**
     * Generate network ID
     * @returns {string} Random network ID
     */
    generateNetworkId() {
        const chars = '0123456789abcdef';
        let id = '';
        for (let i = 0; i < 12; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    /**
     * Generate MAC address
     * @returns {string} Random MAC address
     */
    generateMacAddress() {
        const chars = '0123456789abcdef';
        let mac = '';
        for (let i = 0; i < 6; i++) {
            if (i > 0) mac += ':';
            mac += chars[Math.floor(Math.random() * chars.length)];
            mac += chars[Math.floor(Math.random() * chars.length)];
        }
        return mac;
    }

    /**
     * Docker version command
     * @param {HTMLElement} output - Output element
     */
    dockerVersion(output) {
        this.addTerminalLine(output, 'Client: Docker Engine - Community', 'info');
        this.addTerminalLine(output, ' Version:           28.0.4', 'info');
        this.addTerminalLine(output, ' API version:       1.48', 'info');
        this.addTerminalLine(output, ' Go version:        go1.23.7', 'info');
        this.addTerminalLine(output, ' Git commit:        b8034c0', 'info');
        this.addTerminalLine(output, ' Built:             Tue Mar 25 15:07:11 2025', 'info');
        this.addTerminalLine(output, ' OS/Arch:           linux/amd64', 'info');
        this.addTerminalLine(output, ' Context:           default', 'info');
        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, 'Server: Docker Engine - Community', 'info');
        this.addTerminalLine(output, ' Engine:', 'info');
        this.addTerminalLine(output, '  Version:          28.0.4', 'info');
        this.addTerminalLine(output, '  API version:      1.48 (minimum version 1.24)', 'info');
        this.addTerminalLine(output, '  Go version:       go1.23.7', 'info');
        this.addTerminalLine(output, '  Git commit:       6430e49', 'info');
        this.addTerminalLine(output, '  Built:            Tue Mar 25 15:07:11 2025', 'info');
        this.addTerminalLine(output, '  OS/Arch:          linux/amd64', 'info');
        this.addTerminalLine(output, '  Experimental:     false', 'info');
        this.addTerminalLine(output, ' containerd:', 'info');
        this.addTerminalLine(output, '  Version:          v2.2.1', 'info');
        this.addTerminalLine(output, '  GitCommit:        dea7da592f5d1d2b7755e3a161be07f43fad8f75', 'info');
        this.addTerminalLine(output, ' runc:', 'info');
        this.addTerminalLine(output, '  Version:          1.3.4', 'info');
        this.addTerminalLine(output, '  GitCommit:        v1.3.4-0-gd6d73eb8', 'info');
        this.addTerminalLine(output, ' docker-init:', 'info');
        this.addTerminalLine(output, '  Version:          0.19.0', 'info');
        this.addTerminalLine(output, '  GitCommit:        de40ad0', 'info');
    }
}

// Initialize global instance
window.dockerTerminal = new DockerTerminal();

