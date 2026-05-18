/**
 * ============================================
 * UI CONTROLLER
 * ============================================
 * Manages all user interface interactions and updates
 * 
 * Responsibilities:
 * - Handle button clicks
 * - Manage modals
 * - Update configuration panel
 * - Display logs in UI
 * - Handle connection mode (source/destination selection)
 * - File save/load operations
 */

class UIController {
    constructor() {
        this.connectionMode = 'idle'; // 'idle', 'selecting-source', 'selecting-destination'
        this.selectedSourceNF = null;
        this.selectedDestinationNF = null;

        console.log('✅ UIController initialized');
    }

    /**
     * Initialize all UI components and event listeners
     */
    init() {
        console.log('🎮 Initializing UI...');

        // Setup all button handlers
        this.setupTerminalButton();
        this.setupAddNFButton();
        this.setupClearButton();
        this.setupValidateButton();
        this.setupHelpButton();
        this.setupConnectionButtons();
        this.setupNFPalette();
        this.setupConfigPanelToggle();

        // Initialize log panel
        this.initializeLogPanel();

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        console.log('✅ UI initialized');
    }

    // ==========================================
    // NF PALETTE SETUP
    // ==========================================

    /**
     * Setup NF palette in left sidebar
     */
    setupNFPalette() {
        const palette = document.querySelector('.nf-palette');
        if (!palette) return;

        const nfTypes = ['NRF', 'AUSF', 'UDM', 'PCF', 'NSSF', 'UDR', 'AMF', 'SMF', 'UPF']
        nfTypes.forEach(type => {
            const nfDef = window.nfDefinitions?.[type] || {
                name: type,
                color: '#95a5a6'
            };

            const item = document.createElement('div');
            item.className = 'nf-palette-item';
            item.dataset.type = type;

            item.innerHTML = `
                <div class="nf-icon-small" style="background: ${nfDef.color}">
                    ${type[0]}
                </div>
                <div class="nf-label">
                    <div class="nf-name">${type}</div>
                    <div class="nf-desc">${nfDef.name || type}</div>
                </div>
            `;

            // Click to add NF
            item.addEventListener('click', () => {
                console.log('🖱️ Palette item clicked:', type);
                this.createNFFromPalette(type);
            });

            palette.appendChild(item);
        });

        // Subscribe to data changes to update palette
        if (window.dataStore) {
            window.dataStore.subscribe((event) => {
                if (event === 'nf-added' || event === 'nf-removed') {
                    this.updateNFPaletteStatus();
                }
            });
        }
    }

    /**
     * Update NF palette to show which types are already added
     */
    updateNFPaletteStatus() {
        const palette = document.querySelector('.nf-palette');
        if (!palette) return;

        const allNFs = window.dataStore?.getAllNFs() || [];
        const existingTypes = new Set(allNFs.map(nf => nf.type));

        palette.querySelectorAll('.nf-palette-item').forEach(item => {
            const type = item.dataset.type;
            if (existingTypes.has(type)) {
                item.classList.add('disabled');
                item.style.opacity = '0.5';
                item.style.cursor = 'not-allowed';
                item.title = `${type} already exists (only one instance allowed)`;
            } else {
                item.classList.remove('disabled');
                item.style.opacity = '1';
                item.style.cursor = 'pointer';
                item.title = `Click to add ${type}`;
            }
        });
    }

    /**
     * Update modal NF button states to show which are already added
     */
    updateModalNFButtonStates() {
        const nfGrid = document.getElementById('nf-grid');
        if (!nfGrid) return;

        const allNFs = window.dataStore?.getAllNFs() || [];
        const existingTypes = new Set(allNFs.map(nf => nf.type));

        nfGrid.querySelectorAll('.nf-select-btn').forEach(btn => {
            const type = btn.dataset.type;
            if (existingTypes.has(type)) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.title = `${type} already exists (only one instance allowed)`;
            } else {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.title = `Click to add ${type}`;
            }
        });
    }

    /**
     * Create NF from palette click - NEW WORKFLOW: Show config first
     * @param {string} type - NF type
     */
    createNFFromPalette(type) {
        console.log('🖱️ Palette item clicked:', type);
        
        // Check if this NF type already exists
        if (this.isNFTypeAlreadyExists(type)) {
            alert(`❌ ${type} Already Exists!\n\nOnly ONE instance of each Network Function type is allowed.\n\n${type} is already running in your topology.`);
            return;
        }
        
        // NEW: Show configuration panel first, don't create NF yet
        this.showNFConfigurationForNewNF(type);
    }

    // ==========================================
    // TERMINAL BUTTON
    // ==========================================

    /**
     * Setup Terminal button
     */
    setupTerminalButton() {
        const terminalBtn = document.getElementById('btn-terminal');
        if (!terminalBtn) {
            console.error('❌ Terminal button not found');
            return;
        }

        terminalBtn.addEventListener('click', () => {
            console.log('💻 Terminal button clicked');
            if (window.dockerTerminal) {
                window.dockerTerminal.openTerminal();
            } else {
                console.error('❌ DockerTerminal not available');
                alert('Docker Terminal is not available. Please refresh the page.');
            }
        });
    }

    // ==========================================
    // ADD NF BUTTON & MODAL
    // ==========================================

    /**
     * Setup Add NF button and modal
     */
    setupAddNFButton() {
        const addNFBtn = document.getElementById('btn-add-nf');
        if (!addNFBtn) {
            console.error('❌ Add NF button not found');
            return;
        }

        addNFBtn.addEventListener('click', () => {
            console.log('🖱️ Add NF button clicked');
            this.showAddNFModal();
        });

        // Setup modal
        this.setupAddNFModal();
    }

    /**
     * Setup Add NF modal
     */
    setupAddNFModal() {
        const modal = document.getElementById('add-nf-modal');
        const modalCancel = document.getElementById('modal-cancel');
        const nfGrid = document.getElementById('nf-grid');

        if (!modal || !nfGrid) return;

        // Create NF selection buttons
        const nfTypes = ['NRF', 'AUSF', 'UDM', 'PCF', 'NSSF', 'UDR', 'AMF', 'SMF', 'UPF'];

        nfGrid.innerHTML = '';

        nfTypes.forEach(type => {
            const nfDef = window.nfDefinitions?.[type] || {
                name: type,
                color: '#95a5a6'
            };

            const btn = document.createElement('button');
            btn.className = 'nf-select-btn';
            btn.dataset.type = type;

            btn.innerHTML = `
                <div class="nf-icon" style="background: ${nfDef.color}">
                    ${type[0]}
                </div>
                <div class="nf-label">${type}</div>
            `;

            // Click handler - NEW WORKFLOW: Show config first
            btn.addEventListener('click', () => {
                console.log('🖱️ Modal: Selected NF type:', type);

                // Check if this NF type already exists
                if (this.isNFTypeAlreadyExists(type)) {
                    alert(`❌ ${type} Already Exists!\n\nOnly ONE instance of each Network Function type is allowed.\n\n${type} is already running in your topology.`);
                    modal.style.display = 'none';
                    return;
                }

                // NEW: Show configuration panel first, don't create NF yet
                this.showNFConfigurationForNewNF(type);

                // Close modal
                modal.style.display = 'none';
            });

            nfGrid.appendChild(btn);
        });

        // Cancel button
        if (modalCancel) {
            modalCancel.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    /**
     * Show Add NF modal
     */
    showAddNFModal() {
        // Update button states before showing modal
        this.updateModalNFButtonStates();
        
        const modal = document.getElementById('add-nf-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    // ==========================================
    // CONNECTION BUTTONS (Source/Destination)
    // ==========================================

    /**
     * Setup connection control buttons
     */
    setupConnectionButtons() {
        const btnSource = document.getElementById('btn-select-source');
        const btnDestination = document.getElementById('btn-select-destination');
        const btnCancel = document.getElementById('btn-cancel-connection');

        if (!btnSource || !btnDestination || !btnCancel) {
            console.error('❌ Connection buttons not found');
            return;
        }

        // Select Source button
        btnSource.addEventListener('click', () => {
            console.log('🖱️ Select Source clicked');
            this.enterSourceSelectionMode();
        });

        // Select Destination button
        btnDestination.addEventListener('click', () => {
            console.log('🖱️ Select Destination clicked');
            if (this.selectedSourceNF) {
                // Simplified: Just enter destination mode - user can click NF or Bus
                this.enterDestinationSelectionMode();
                console.log('💡 You can now click on an NF or Bus Line to connect!');
            } else {
                alert('Please select a source NF first!');
            }
        });

        // Cancel button
        btnCancel.addEventListener('click', () => {
            console.log('🖱️ Connection cancelled');
            this.cancelConnectionMode();
        });

        // Listen to canvas clicks for connection mode
        this.setupConnectionModeListener();
    }

    /**
     * Enter bus selection mode
     */
    enterBusSelectionMode() {
        this.connectionMode = 'selecting-bus';

        const btnDestination = document.getElementById('btn-select-destination');
        btnDestination.classList.add('active');
        btnDestination.style.background = '#27ae60';

        this.showCanvasMessage(`Select a SERVICE BUS to connect ${this.selectedSourceNF.name}`);
    }

    /**
     * Select bus and create connection
         */
    selectBus(bus) {
        console.log('✅ Bus selected as destination:', bus.name);

        if (this.selectedSourceNF) {
            // NF to Bus connection
            console.log('🔗 Creating NF-to-Bus connection:', this.selectedSourceNF.name, '→', bus.name);
            if (window.busManager) {
                const connection = window.busManager.connectNFToBus(this.selectedSourceNF.id, bus.id);
                if (connection) {
                    console.log('✅ NF-to-Bus connection created successfully!');
                }
            }
        } else if (this.selectedSourceBus) {
            // Bus to Bus connection
            console.log('🔗 Creating Bus-to-Bus connection:', this.selectedSourceBus.name, '→', bus.name);
            if (window.busManager) {
                const connection = window.busManager.connectBusToBus(this.selectedSourceBus.id, bus.id);
                if (connection) {
                    console.log('✅ Bus-to-Bus connection created successfully!');
                }
            }
        } else {
            console.error('❌ No source selected!');
            alert('Error: No source selected');
        }

        this.cancelConnectionMode();
    }

    /**
     * Setup listener for connection mode canvas clicks
     */
    setupConnectionModeListener() {
        if (window.dataStore) {
            window.dataStore.subscribe((event, data) => {
                if (event === 'nf-added') {
                    this.updateLogNFFilter();
                }
            });
        }

        const canvas = document.getElementById('main-canvas');
        if (canvas) {
            canvas.addEventListener('click', (e) => {
                if (this.connectionMode === 'idle') return;

                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const clickedNF = window.canvasRenderer?.getNFAtPosition(x, y);
                const clickedBus = this.getBusAtPosition(x, y);

                console.log('🖱️ Canvas click in connection mode:', this.connectionMode);
                console.log('🖱️ Clicked NF:', clickedNF?.name || 'none');
                console.log('🖱️ Clicked Bus:', clickedBus?.name || 'none');

                if (this.connectionMode === 'selecting-source') {
                    // In source mode, allow clicking either NF or Bus
                    if (clickedNF) {
                        console.log('🔗 Selecting NF as source...');
                        this.selectSourceNF(clickedNF);
                    } else if (clickedBus) {
                        console.log('🚌 Selecting Bus as source...');
                        this.selectSourceBus(clickedBus);
                    } else {
                        console.log('❌ Please click on an NF or Bus Line');
                    }
                } else if (this.connectionMode === 'selecting-destination') {
                    // In destination mode, allow clicking either NF or Bus
                    if (clickedNF) {
                        console.log('🔗 Connecting to NF...');
                        this.selectDestinationNF(clickedNF);
                    } else if (clickedBus) {
                        console.log(' Connecting to Bus...');
                        this.selectBus(clickedBus);
                    } else {
                        console.log('❌ Please click on an NF or Bus Line');
                    }
                } else if (this.connectionMode === 'selecting-bus' && clickedBus) {
                    // Keep this for backward compatibility
                    console.log(' Bus click detected, calling selectBus...');
                    this.selectBus(clickedBus);
                }
            });
        }
    }
    /**
     * Enter source selection mode
     */
    enterSourceSelectionMode() {
        this.connectionMode = 'selecting-source';
        this.selectedSourceNF = null;
        this.selectedSourceBus = null; // NEW: Clear bus source
        this.selectedDestinationNF = null;

        // Update UI
        const btnSource = document.getElementById('btn-select-source');
        const btnDestination = document.getElementById('btn-select-destination');
        const btnCancel = document.getElementById('btn-cancel-connection');

        btnSource.classList.add('active');
        btnSource.style.background = '#3498db';
        btnDestination.disabled = true;
        btnCancel.style.display = 'block';

        // Show canvas message
        // this.showCanvasMessage('Click an NF or BUS LINE to set as SOURCE');
    }

    /**
     * Enter destination selection mode
     */
    enterDestinationSelectionMode() {
        this.connectionMode = 'selecting-destination';

        // Update UI
        const btnSource = document.getElementById('btn-select-source');
        const btnDestination = document.getElementById('btn-select-destination');

        btnSource.classList.remove('active');
        btnSource.style.background = '';
        btnDestination.classList.add('active');
        btnDestination.style.background = '#4caf50';

        // // Show canvas message
        // const sourceName = this.selectedSourceNF?.name || this.selectedSourceBus?.name || 'source';
        // this.showCanvasMessage(`Click on an NF or BUS LINE to connect from ${sourceName}`);
    }

    /**
     * Select source NF
     * @param {Object} nf - Selected NF
     */
    selectSourceNF(nf) {
        console.log('✅ Source selected:', nf.name);
        this.selectedSourceNF = nf;

        // Enable destination button
        const btnDestination = document.getElementById('btn-select-destination');
        btnDestination.disabled = false;

        // Auto-switch to destination mode
        this.enterDestinationSelectionMode();
    }

    /**
     * Select source Bus
     * @param {Object} bus - Selected Bus
     */
    selectSourceBus(bus) {
        console.log('✅ Bus source selected:', bus.name);
        this.selectedSourceBus = bus;
        this.selectedSourceNF = null; // Clear NF selection

        // Enable destination button
        const btnDestination = document.getElementById('btn-select-destination');
        btnDestination.disabled = false;

        // Auto-switch to destination mode
        this.enterDestinationSelectionMode();
    }

    /**
     * Select destination NF and create connection
     * @param {Object} nf - Selected NF
     */
    selectDestinationNF(nf) {
        console.log('✅ NF selected as destination:', nf.name);
        this.selectedDestinationNF = nf;

        if (this.selectedSourceNF) {
            // NF to NF connection (standard)
            console.log('🔗 Creating NF-to-NF connection:', this.selectedSourceNF.name, '→', nf.name);
            if (window.connectionManager) {
                // Create manual connection (with visual line)
                const connection = window.connectionManager.createManualConnection(
                    this.selectedSourceNF.id,
                    this.selectedDestinationNF.id
                );

                if (connection) {
                    console.log('✅ NF-to-NF connection created successfully');
                }
            }
        } else if (this.selectedSourceBus) {
            // Bus to NF connection
            console.log('🔗 Creating Bus-to-NF connection:', this.selectedSourceBus.name, '→', nf.name);
            if (window.busManager) {
                const connection = window.busManager.connectBusToNF(this.selectedSourceBus.id, nf.id);
                if (connection) {
                    console.log('✅ Bus-to-NF connection created successfully');
                }
            }
        } else {
            console.error('❌ No source selected!');
            alert('Error: No source selected');
        }

        // Reset connection mode
        this.cancelConnectionMode();
    }

    /**
     * Cancel connection mode
     */
    cancelConnectionMode() {
        this.connectionMode = 'idle';
        this.selectedSourceNF = null;
        this.selectedSourceBus = null; // NEW: Clear bus source
        this.selectedDestinationNF = null;

        // Update UI
        const btnSource = document.getElementById('btn-select-source');
        const btnDestination = document.getElementById('btn-select-destination');
        const btnCancel = document.getElementById('btn-cancel-connection');

        btnSource.classList.remove('active');
        btnSource.style.background = '';
        btnDestination.classList.remove('active');
        btnDestination.style.background = '';
        btnDestination.disabled = true;
        btnCancel.style.display = 'none';

        // Hide canvas message
        this.hideCanvasMessage();
    }

    /**
     * Show canvas message
     * @param {string} message - Message to display
     */
    showCanvasMessage(message) {
        const msgElement = document.getElementById('canvas-message');
        if (msgElement) {
            msgElement.textContent = message;
            msgElement.classList.add('show');
        }
    }

    /**
     * Hide canvas message
     */
    hideCanvasMessage() {
        const msgElement = document.getElementById('canvas-message');
        if (msgElement) {
            msgElement.classList.remove('show');
        }
    }

    // ==========================================
    // SAVE / LOAD / CLEAR BUTTONS
    // ==========================================



    /**
     * Setup Clear button
     */
    setupClearButton() {
        const clearBtn = document.getElementById('btn-clear');
        if (!clearBtn) return;

        clearBtn.addEventListener('click', () => {
            console.log('🗑️ Clear clicked');
            this.clearTopology();
        });
    }

    /**
     * Clear entire topology
     */
    clearTopology() {
        if (!confirm('Are you sure you want to clear the entire topology? This cannot be undone.')) {
            return;
        }

        // Clear data
        if (window.dataStore) {
            window.dataStore.clearAll();
        }

        // Clear logs
        if (window.logEngine) {
            window.logEngine.clearAllLogs();
        }

        // Clear log UI
        const logContent = document.getElementById('log-content');
        if (logContent) {
            logContent.innerHTML = '';
        }

        // Re-render canvas
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }

        console.log('✅ Topology cleared');
        alert('Topology cleared successfully!');
        // Full refresh ensures complete re-initialization of all managers and UI state
        window.location.reload();
    }

    /**
     * Setup Validate button
     */
    setupValidateButton() {
        const validateBtn = document.getElementById('btn-validate');
        if (!validateBtn) return;

        validateBtn.addEventListener('click', () => {
            console.log('✓ Validate clicked');
            this.validateTopology();
        });
    }

    /**
     * Validate topology
     */
    validateTopology() {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const allConnections = window.dataStore?.getAllConnections() || [];

        if (allNFs.length === 0) {
            alert('Topology is empty. Add some Network Functions first.');
            return;
        }

        let report = '═══════════════════════════════════\n';
        report += '5G TOPOLOGY VALIDATION REPORT\n';
        report += '═══════════════════════════════════\n\n';

        // Check for NRF
        const hasNRF = allNFs.some(nf => nf.type === 'NRF');
        if (!hasNRF) {
            report += '❌ CRITICAL: NRF is missing!\n';
            report += '   NRF is required as the central registry.\n\n';
        } else {
            report += '✅ NRF exists\n\n';
        }

        // Check each NF
        report += 'NETWORK FUNCTIONS:\n';
        report += '─────────────────────────────────\n';
        allNFs.forEach(nf => {
            const connections = window.dataStore.getConnectionsForNF(nf.id);
            report += `${nf.name} (${nf.type}): ${connections.length} connections\n`;
        });

        report += '\n';
        report += `Total NFs: ${allNFs.length}\n`;
        report += `Total Connections: ${allConnections.length}\n`;

        report += '\n═══════════════════════════════════\n';
        report += hasNRF ? 'STATUS: ✅ VALID' : 'STATUS: ❌ INVALID';
        report += '\n═══════════════════════════════════';

        alert(report);
        console.log(report);
    }

    /**
     * Setup Help button
     */
    setupHelpButton() {
        const helpBtn = document.getElementById('btn-help');
        if (!helpBtn) return;

        helpBtn.addEventListener('click', () => {
            console.log('❓ Help clicked');
            this.showHelpModal();
        });
    }

    /**
     * Show Help modal
     */
    showHelpModal() {
        const modal = document.getElementById('help-modal');
        if (!modal) return;
        modal.style.display = 'flex';

        const closeBtn = document.getElementById('help-close');
        if (closeBtn) {
            closeBtn.onclick = () => { modal.style.display = 'none'; };
        }

        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };
    }

    // ==========================================
    // CONFIGURATION PANEL
    // ==========================================

    /**
     * Show NF configuration panel for NEW NF (before creation)
     * @param {string} nfType - NF type to configure
     */
    showNFConfigurationForNewNF(nfType) {
        const configForm = document.getElementById('config-form');
        if (!configForm) return;

        // Get NF definition for defaults
        const nfDef = window.nfManager?.getNFDefinition(nfType) || { name: nfType, color: '#95a5a6' };

        // Generate unique default values automatically
        const count = (window.nfManager?.nfCounters[nfType] || 0) + 1;
        const defaultName = `${nfType}-${count}`;
        
        // Get next available unique IP and port
        const defaultIP = this.getNextAvailableIP();
        const defaultPort = this.getNextAvailablePort();
        const globalProtocol = window.globalHTTPProtocol || 'HTTP/2';

        configForm.innerHTML = `
            <h4>Configure New ${nfType}</h4>
            
            <div class="form-group">
                
                <input type="text" id="config-ip" value="${defaultIP}" required>
                
            </div>
            
            <div class="form-group">
                
                <input type="number" id="config-port" value="${defaultPort}" required>
            
            </div>
            
            <div class="form-group">
                <label>🌐 HTTP Protocol (Global Setting)</label>
                <select id="config-http-protocol">
                    <option value="HTTP/1" ${globalProtocol === 'HTTP/1' ? 'selected' : ''}>HTTP/1.1</option>
                    <option value="HTTP/2" ${globalProtocol === 'HTTP/2' ? 'selected' : ''}>HTTP/2</option>
                </select>
                <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                    ⚠️ Changing this will update ALL Network Functions in topology
                </small>
            </div>
            
            <button class="btn btn-success btn-block" id="btn-start-nf" data-nf-type="${nfType}">
                🚀 Start Network Function
            </button>
            <button class="btn btn-secondary btn-block" id="btn-cancel-nf">Cancel</button>
        `;

        // Protocol change event listener
        const protocolSelect = document.getElementById('config-http-protocol');
        if (protocolSelect) {
            protocolSelect.addEventListener('change', (e) => {
                const newProtocol = e.target.value;
                const currentProtocol = window.globalHTTPProtocol || 'HTTP/2';

                if (newProtocol !== currentProtocol) {
                    const allNFs = window.dataStore?.getAllNFs() || [];
                    const confirmMsg = `⚠️ GLOBAL PROTOCOL CHANGE\n\n` +
                        `This will change HTTP protocol for ALL ${allNFs.length} Network Functions from ${currentProtocol} to ${newProtocol}.\n\n` +
                        `All NFs will use ${newProtocol} for Service-Based Interfaces.\n\n` +
                        `Do you want to continue?`;

                    if (confirm(confirmMsg)) {
                        if (window.nfManager) {
                            const updateCount = window.nfManager.updateGlobalProtocol(newProtocol);
                            alert(`✅ Success!\n\nUpdated ${updateCount} Network Functions to ${newProtocol}`);
                        }
                    } else {
                        protocolSelect.value = currentProtocol;
                    }
                }
            });
        }

        // Start button handler
        const startBtn = document.getElementById('btn-start-nf');
        startBtn.addEventListener('click', () => {
            this.startNewNetworkFunction(nfType);
        });

        // Cancel button handler
        const cancelBtn = document.getElementById('btn-cancel-nf');
        cancelBtn.addEventListener('click', () => {
            this.hideNFConfigPanel();
        });
    }

    /**
     * Show NF configuration panel
     * @param {Object} nf - Network Function to configure
     */
    showNFConfigPanel(nf) {
        const configForm = document.getElementById('config-form');
        if (!configForm) return;

        configForm.innerHTML = `
            <h4>${nf.name} Configuration</h4>
            
            <div class="form-group">
                <label>NF Type</label>
                <input type="text" value="${nf.type}" disabled>
            </div>
            
            <div class="form-group">
                <label>IP Address</label>
                <input type="text" id="config-ip" value="${nf.config.ipAddress}">
            </div>
            
            <div class="form-group">
                <label>Port</label>
                <input type="number" id="config-port" value="${nf.config.port}">
            </div>
            
            
            <div class="form-group">
                <label>🌐 HTTP Protocol (Global Setting)</label>
                <select id="config-http-protocol">
                    <option value="HTTP/1" ${nf.config.httpProtocol === 'HTTP/1' ? 'selected' : ''}>HTTP/1.1</option>
                    <option value="HTTP/2" ${nf.config.httpProtocol === 'HTTP/2' ? 'selected' : ''}>HTTP/2</option>
                </select>
                <small style="color: #95a5a6; font-size: 11px; display: block; margin-top: 4px;">
                    ⚠️ Changing this will update ALL Network Functions in topology
                </small>
            </div>
            
            
            <button class="btn btn-primary btn-block" id="btn-save-config">Save Changes</button>
            <button class="btn btn-danger btn-block" id="btn-delete-nf">Delete NF</button>
            
            
            <button class="btn btn-terminal btn-block" id="btn-open-terminal">
                💻 Open Command Prompt
            </button>
            
        `;

        // Protocol change event listener
        const protocolSelect = document.getElementById('config-http-protocol');
        if (protocolSelect) {
            protocolSelect.addEventListener('change', (e) => {
                const newProtocol = e.target.value;

                // Show confirmation dialog
                const currentProtocol = window.globalHTTPProtocol || 'HTTP/2';
                if (newProtocol !== currentProtocol) {
                    const allNFs = window.dataStore?.getAllNFs() || [];
                    const confirmMsg = `⚠️ GLOBAL PROTOCOL CHANGE\n\n` +
                        `This will change HTTP protocol for ALL ${allNFs.length} Network Functions from ${currentProtocol} to ${newProtocol}.\n\n` +
                        `All NFs will use ${newProtocol} for Service-Based Interfaces.\n\n` +
                        `Do you want to continue?`;

                    if (confirm(confirmMsg)) {
                        // Update global protocol
                        if (window.nfManager) {
                            const updateCount = window.nfManager.updateGlobalProtocol(newProtocol);
                            alert(`✅ Success!\n\nUpdated ${updateCount} Network Functions to ${newProtocol}`);

                            // Refresh config panel to show updated value
                            this.showNFConfigPanel(nf);
                        }
                    } else {
                        // Revert selection
                        protocolSelect.value = currentProtocol;
                    }
                }
            });
        }

        // Save button handler
        const saveBtn = document.getElementById('btn-save-config');
        saveBtn.addEventListener('click', () => {
            this.saveNFConfig(nf.id);
        });

        // Delete button handler
        const deleteBtn = document.getElementById('btn-delete-nf');
        deleteBtn.addEventListener('click', () => {
            this.deleteNF(nf.id);
        });

        // Ping troubleshooting handlers
        this.setupPingTroubleshootingHandlers(nf.id);
    }

    /**
     * Start new Network Function with IP conflict prevention
     * @param {string} nfType - NF type
     */
    startNewNetworkFunction(nfType) {
        const ipAddress = document.getElementById('config-ip')?.value;
        const port = parseInt(document.getElementById('config-port')?.value);
        const httpProtocol = document.getElementById('config-http-protocol')?.value;

        if (!ipAddress || !port) {
            alert('Please fill all required fields');
            return;
        }
        
        // Generate unique default name automatically
        const count = (window.nfManager?.nfCounters[nfType] || 0) + 1;
        const name = `${nfType}-${count}`;

        // Validate IP address format
        if (!this.isValidIP(ipAddress)) {
            alert('❌ Invalid IP address format!\n\nPlease enter a valid IP address (e.g., 192.168.1.20)');
            return;
        }

        // Check for IP conflicts
        if (!window.nfManager?.isIPAddressAvailable(ipAddress)) {
            alert(`❌ IP Conflict Detected!\n\nIP address ${ipAddress} is already in use by another service.\n\nPlease choose a different IP address.`);
            return;
        }

        // Check for port conflicts
        if (!window.nfManager?.isPortAvailable(port)) {
            alert(`❌ Port Conflict Detected!\n\nPort ${port} is already in use by another service.\n\nPlease choose a different port number.`);
            return;
        }

        console.log('🚀 Starting new NF:', { nfType, name, ipAddress, port, httpProtocol });

        // Calculate position with proper spacing
        const position = this.calculateNFPositionWithSpacing(nfType);

        // Create NF with automatic unique IP/port (will be overridden)
        if (window.nfManager) {
            const nf = window.nfManager.createNetworkFunction(nfType, position);

            if (nf) {
                // Override with user-specified configuration
                nf.name = name;
                nf.config.ipAddress = ipAddress;
                nf.config.port = port;
                nf.config.httpProtocol = httpProtocol;

                // Update in data store
                window.dataStore.updateNF(nf.id, nf);

                console.log('✅ NF started successfully:', nf.name);

                // Log service creation with network info
                if (window.logEngine) {
                    window.logEngine.addLog(nf.id, 'SUCCESS',
                        `${nf.name} created successfully`, {
                        ipAddress: ipAddress,
                        port: port,
                        subnet: window.nfManager?.getNetworkFromIP(ipAddress) + '.0/24',
                        protocol: httpProtocol,
                        status: 'starting',
                        note: 'Service will be stable in 5 seconds'
                    });
                }

                // Auto-connect to bus if applicable
                this.autoConnectToBusIfApplicable(nf);

                // Clear configuration panel
                this.hideNFConfigPanel();

                // Re-render canvas
                if (window.canvasRenderer) {
                    window.canvasRenderer.render();
                }
            }
        } else {
            console.error('❌ NFManager not available');
            alert('Error: NFManager not available');
        }
    }

    /**
     * Calculate NF position with proper spacing
     * @param {string} nfType - NF type
     * @returns {Object} {x, y} position
     */
    calculateNFPositionWithSpacing(nfType) {
        const allNFs = window.dataStore?.getAllNFs() || [];

        // Grid layout with better spacing
        const nfsPerRow = 6;  // More NFs per row
        const nfWidth = 60;   // Smaller width for better fit
        const nfHeight = 80;  // Height including label
        const marginX = 40;   // Horizontal spacing
        const marginY = 60;   // Vertical spacing
        const startX = 120;   // Start position X
        const startY = 120;   // Start position Y

        const totalNFs = allNFs.length;
        const row = Math.floor(totalNFs / nfsPerRow);
        const col = totalNFs % nfsPerRow;

        return {
            x: startX + col * (nfWidth + marginX),
            y: startY + row * (nfHeight + marginY)
        };
    }

    /**
     * Auto-connect NF to bus line if applicable.
     * Always uses the topology bus so manual and terminal NFs share one bus line.
     * @param {Object} nf - Network Function
     */
    async autoConnectToBusIfApplicable(nf) {
        // Don't auto-connect UPF, gNB, and UE to the service bus
        const excludedTypes = ['UPF', 'gNB', 'UE'];
        if (excludedTypes.includes(nf.type)) {
            console.log(`🚫 Skipping bus auto-connect for ${nf.type} (excluded type)`);
            return;
        }

        // Try to load topology to get the canonical bus
        let filteredTopology = null;
        try {
            const response = await fetch('../one-click.json');
            if (response.ok) {
                const topology = await response.json();
                if (window.dockerTerminal) {
                    filteredTopology = window.dockerTerminal.filterTopology(topology);
                }
            }
        } catch (e) {
            console.warn('autoConnectToBusIfApplicable: could not load topology', e);
        }

        if (filteredTopology && window.dockerTerminal) {
            // Rebuild buses from topology so all NFs share the same bus
            window.dockerTerminal.removeAllBusesAndBusConnections();
            const allNFs = window.dataStore?.getAllNFs() || [];
            allNFs.forEach(existingNF => window.dockerTerminal.ensureNFConnectedToBus(existingNF, filteredTopology));
            if (window.canvasRenderer) window.canvasRenderer.render();
            return;
        }

        // Fallback: connect to the first available bus
        const allBuses = window.dataStore?.getAllBuses() || [];
        if (allBuses.length === 0) {
            console.log('ℹ️ No bus lines available for auto-connect');
            return;
        }

        const targetBus = allBuses[0];
        if (window.busManager) {
            console.log(`🔗 Auto-connecting ${nf.name} to ${targetBus.name}`);
            const connection = window.busManager.connectNFToBus(nf.id, targetBus.id);
            if (connection && window.logEngine) {
                window.logEngine.addLog(nf.id, 'INFO',
                    `Auto-connected to ${targetBus.name} service bus`, {
                    busId: targetBus.id,
                    interfaceName: connection.interfaceName,
                    autoConnect: true
                });
            }
        }
    }

    /**
     * Hide NF configuration panel
     */
    hideNFConfigPanel() {
        const configForm = document.getElementById('config-form');
        if (configForm) {
            configForm.innerHTML = '<p class="hint">Select a Network Function type to configure and start it</p>';
        }
    }

    /**
     * Save NF configuration with IP conflict prevention
     * @param {string} nfId - NF ID
     */
    saveNFConfig(nfId) {
        const ipAddress = document.getElementById('config-ip')?.value;
        const port = parseInt(document.getElementById('config-port')?.value);
        const httpProtocol = document.getElementById('config-http-protocol')?.value;

        if (!ipAddress || !port) {
            alert('Please fill all required fields');
            return;
        }

        // Validate IP address format
        if (!this.isValidIP(ipAddress)) {
            alert('❌ Invalid IP address format!\n\nPlease enter a valid IP address (e.g., 192.168.1.20)');
            return;
        }

        // Check for IP conflicts (excluding current NF)
        const currentNf = window.dataStore.getNFById(nfId);
        if (currentNf && currentNf.config.ipAddress !== ipAddress) {
            if (!window.nfManager?.isIPAddressAvailable(ipAddress)) {
                alert(`❌ IP Conflict Detected!\n\nIP address ${ipAddress} is already in use by another service.\n\nPlease choose a different IP address.`);
                return;
            }
        }

        // Check for port conflicts (excluding current NF)
        if (currentNf && currentNf.config.port !== port) {
            if (!window.nfManager?.isPortAvailable(port)) {
                alert(`❌ Port Conflict Detected!\n\nPort ${port} is already in use by another service.\n\nPlease choose a different port number.`);
                return;
            }
        }

        // Update NF
        const nf = window.dataStore.getNFById(nfId);
        if (nf) {
            const oldIP = nf.config.ipAddress;
            const oldPort = nf.config.port;

            // Keep existing name, don't update it
            nf.config.ipAddress = ipAddress;
            nf.config.port = port;
            nf.config.httpProtocol = httpProtocol;

            window.dataStore.updateNF(nfId, nf);

            // Log configuration change
            if (window.logEngine) {
                const changes = [];
                if (oldIP !== ipAddress) changes.push(`IP: ${oldIP} → ${ipAddress}`);
                if (oldPort !== port) changes.push(`Port: ${oldPort} → ${port}`);
                
                if (changes.length > 0) {
                    window.logEngine.addLog(nfId, 'INFO',
                        `Configuration updated: ${changes.join(', ')}`, {
                        previousIP: oldIP,
                        newIP: ipAddress,
                        previousPort: oldPort,
                        newPort: port,
                        subnet: window.nfManager?.getNetworkFromIP(ipAddress) + '.0/24'
                    });
                }
            }

            // Re-render
            if (window.canvasRenderer) {
                window.canvasRenderer.render();
            }

            alert('✅ Configuration saved successfully!\n\n' + 
                  `IP: ${ipAddress}\n` +
                  `Port: ${port}\n` +
                  `Subnet: ${window.nfManager?.getNetworkFromIP(ipAddress)}.0/24`);
            console.log('✅ NF config saved:', nf.name);
        }
    }

    /**
     * Delete NF
     * @param {string} nfId - NF ID
     */
    deleteNF(nfId) {
        const nf = window.dataStore.getNFById(nfId);
        if (!nf) return;

        if (!confirm(`Are you sure you want to delete ${nf.name}?`)) {
            return;
        }

        if (window.nfManager) {
            window.nfManager.deleteNetworkFunction(nfId);
        }

        this.hideNFConfigPanel();
    }

    // ==========================================
    // LOG PANEL
    // ==========================================

    /**
     * Initialize log panel
     */
    initializeLogPanel() {
        console.log('📋 Initializing log panel...');

        // Subscribe to log engine
        if (window.logEngine) {
            window.logEngine.subscribe((logEntry) => {
                if (logEntry.type) return; // Skip event objects
                this.appendLogToUI(logEntry);
            });
        }

        // Keep NF filter dropdown in sync whenever NFs are added or removed
        if (window.dataStore) {
            window.dataStore.subscribe((event) => {
                if (event === 'nf-added' || event === 'nf-removed' || event === 'data-imported') {
                    this.updateLogNFFilter();
                }
            });
        }

        // Setup log controls
        const filterNF = document.getElementById('log-filter-nf');
        const filterLevel = document.getElementById('log-filter-level');
        const clearBtn = document.getElementById('btn-clear-logs');
        const exportBtn = document.getElementById('btn-export-logs');
        const toggleBtn = document.getElementById('btn-toggle-logs');

        if (filterNF) {
            filterNF.addEventListener('change', () => this.filterLogs());
        }

        if (filterLevel) {
            filterLevel.addEventListener('change', () => this.filterLogs());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const logContent = document.getElementById('log-content');
                if (logContent) {
                    logContent.innerHTML = '';
                }
                if (window.logEngine) {
                    window.logEngine.clearAllLogs();
                }
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportLogs());
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleLogPanel());
        }

        console.log('✅ Log panel initialized');
    }

    /**
     * Append log entry to UI
     * @param {Object} logEntry - Log entry object
     */
    appendLogToUI(logEntry) {
        const logContent = document.getElementById('log-content');
        if (!logContent) return;

        const nf = window.dataStore?.getNFById(logEntry.nfId);
        const nfName = nf?.name || logEntry.nfId;

        const logDiv = document.createElement('div');
        logDiv.className = `log-entry ${logEntry.level}`;
        logDiv.dataset.nfId = logEntry.nfId;
        logDiv.dataset.level = logEntry.level;

        const time = new Date(logEntry.timestamp).toLocaleTimeString();

        logDiv.innerHTML = `
            <span class="log-timestamp">[${time}]</span>
            <span class="log-nf-name">${nfName}</span>
            <span class="log-level">${logEntry.level}</span>
            <span class="log-message">${this.escapeHtml(logEntry.message)}</span>
        `;

        // Add details if present
        if (logEntry.details && Object.keys(logEntry.details).length > 0) {
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'log-details';

            Object.entries(logEntry.details).forEach(([key, value]) => {
                const detailLine = document.createElement('div');
                detailLine.textContent = `${key}: ${JSON.stringify(value)}`;
                detailsDiv.appendChild(detailLine);
            });

            logDiv.appendChild(detailsDiv);
        }

        logContent.appendChild(logDiv);

        // Auto-scroll to bottom
        logContent.scrollTop = logContent.scrollHeight;

        // Limit displayed logs
        while (logContent.children.length > 500) {
            logContent.removeChild(logContent.firstChild);
        }
    }

    /**
     * Filter logs based on selected filters
     */
    filterLogs() {
        const filterNF = document.getElementById('log-filter-nf')?.value || 'all';
        const filterLevel = document.getElementById('log-filter-level')?.value || 'all';
        const logContent = document.getElementById('log-content');

        if (!logContent) return;

        const allLogEntries = logContent.querySelectorAll('.log-entry');

        allLogEntries.forEach(entry => {
            let show = true;

            if (filterNF !== 'all' && entry.dataset.nfId !== filterNF) {
                show = false;
            }

            if (filterLevel !== 'all' && entry.dataset.level !== filterLevel) {
                show = false;
            }

            entry.style.display = show ? 'flex' : 'none';
        });
    }

    /**
     * Update NF filter dropdown in log panel
     */
    updateLogNFFilter() {
        const select = document.getElementById('log-filter-nf');
        if (!select) return;

        const currentValue = select.value;

        // Clear options except "All NFs"
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Add option for each NF
        const allNFs = window.dataStore?.getAllNFs() || [];
        allNFs.forEach(nf => {
            const option = document.createElement('option');
            option.value = nf.id;
            option.textContent = `${nf.name} (${nf.type})`;
            select.appendChild(option);
        });

        // Restore previous selection if valid
        if (currentValue && [...select.options].some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    }

    /**
     * Export logs
     */
    exportLogs() {
        if (!window.logEngine) return;

        const format = prompt('Export format (json/csv/txt):', 'txt');

        if (!format) return;

        let content, filename, mimeType;

        if (format.toLowerCase() === 'json') {
            content = window.logEngine.exportLogsAsJSON();
            filename = `5g-logs-${Date.now()}.json`;
            mimeType = 'application/json';
        } else if (format.toLowerCase() === 'csv') {
            content = window.logEngine.exportLogsAsCSV();
            filename = `5g-logs-${Date.now()}.csv`;
            mimeType = 'text/csv';
        } else if (format.toLowerCase() === 'txt') {
            content = window.logEngine.exportLogsAsText();
            filename = `5g-logs-${Date.now()}.txt`;
            mimeType = 'text/plain';
        } else {
            alert('Invalid format. Use "json", "csv", or "txt"');
            return;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        console.log('✅ Logs exported as', format);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Toggle log panel visibility
     */
    toggleLogPanel() {
        const logPanel = document.getElementById('log-panel');
        const toggleIcon = document.getElementById('toggle-icon');

        if (!logPanel || !toggleIcon) return;

        const isCollapsed = logPanel.classList.contains('collapsed');

        if (isCollapsed) {
            // Show logs
            logPanel.classList.remove('collapsed');
            toggleIcon.textContent = '▼';
            console.log('📋 Log panel expanded');
        } else {
            // Hide logs
            logPanel.classList.add('collapsed');
            toggleIcon.textContent = '▲';
            console.log('📋 Log panel collapsed');
        }

        // Trigger canvas resize after panel toggle animation completes
        setTimeout(() => {
            if (window.canvasRenderer) {
                window.canvasRenderer.resizeCanvas();
            }
        }, 350); // Wait for CSS transition to complete (300ms + buffer)
    }

    /**
     * Setup configuration panel toggle
     */
    setupConfigPanelToggle() {
        const toggleBtn = document.getElementById('btn-toggle-config');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleConfigPanel());
            console.log('✅ Config panel toggle initialized');
        } else {
            console.warn('⚠️ Config panel toggle button not found');
        }
    }

    /**
     * Toggle configuration panel visibility
     */
    toggleConfigPanel() {
        const sidebar = document.querySelector('.sidebar-right');
        const toggleIcon = document.getElementById('config-toggle-icon');

        if (!sidebar || !toggleIcon) return;

        const isCollapsed = sidebar.classList.contains('collapsed');

        if (isCollapsed) {
            // Show config panel
            sidebar.classList.remove('collapsed');
            toggleIcon.textContent = '◀';
            console.log('⚙️ Config panel expanded');
        } else {
            // Hide config panel
            sidebar.classList.add('collapsed');
            toggleIcon.textContent = '▶';
            console.log('⚙️ Config panel collapsed');
        }

        // Trigger canvas resize after panel toggle animation completes
        setTimeout(() => {
            if (window.canvasRenderer) {
                window.canvasRenderer.resizeCanvas();
            }
        }, 350); // Wait for CSS transition to complete (300ms + buffer)
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + L to toggle logs
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this.toggleLogPanel();
            }

            // Ctrl/Cmd + K to toggle config panel
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggleConfigPanel();
            }

            // F1 or Ctrl/Cmd + H to show help
            if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key === 'h')) {
                e.preventDefault();
                this.showHelpModal();
            }
        });

        console.log('⌨️ Keyboard shortcuts initialized (Ctrl+L: Toggle logs, Ctrl+K: Toggle config, F1/Ctrl+H: Help)');
    }




    /**
     * Setup ping troubleshooting handlers
     * @param {string} nfId - NF ID
     */
    setupPingTroubleshootingHandlers(nfId) {
        const terminalBtn = document.getElementById('btn-open-terminal');
        const pingHistoryBtn = document.getElementById('btn-ping-history');

        if (terminalBtn) {
            terminalBtn.addEventListener('click', () => {
                this.openWindowsTerminal(nfId);
            });
        }

        if (pingHistoryBtn) {
            pingHistoryBtn.addEventListener('click', () => {
                this.showPingHistory(nfId);
            });
        }
    }

    /**
     * Execute ping to specific target IP
     * @param {string} nfId - Source NF ID
     */
    async executePingTarget(nfId) {
        const targetIP = document.getElementById('ping-target-ip')?.value?.trim();
        
        if (!targetIP) {
            alert('Please enter a target IP address');
            return;
        }

        // Validate IP format
        if (!this.isValidIP(targetIP)) {
            alert('Please enter a valid IP address (e.g., 192.168.1.20)');
            return;
        }

        const nf = window.dataStore?.getNFById(nfId);
        if (!nf) return;

        // Check if ping is already active
        if (window.pingManager && window.pingManager.isPingActive(nfId)) {
            alert('Ping is already in progress. Please wait for it to complete.');
            return;
        }

        console.log(`🏓 Executing ping from ${nf.name} to ${targetIP}`);

        // Disable button during ping
        const btn = document.getElementById('btn-ping-target');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '🏓 Pinging...';
        }

        try {
            if (window.pingManager) {
                await window.pingManager.executePing(nfId, targetIP, 4);
            } else {
                console.error('❌ PingManager not available');
                alert('Ping functionality not available');
            }
        } catch (error) {
            console.error('❌ Ping error:', error);
            if (window.logEngine) {
                window.logEngine.addLog(nfId, 'ERROR', `Ping failed: ${error.message}`);
            }
        } finally {
            // Re-enable button
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🏓 Ping Target IP';
            }
        }
    }

    /**
     * Execute ping to all network services
     * @param {string} nfId - Source NF ID
     */
    async executePingNetwork(nfId) {
        const nf = window.dataStore?.getNFById(nfId);
        if (!nf) return;

        // Check if ping is already active
        if (window.pingManager && window.pingManager.isPingActive(nfId)) {
            alert('Ping is already in progress. Please wait for it to complete.');
            return;
        }

        console.log(`📡 Executing network ping from ${nf.name}`);

        // Disable button during ping
        const btn = document.getElementById('btn-ping-network');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '📡 Scanning Network...';
        }

        try {
            if (window.pingManager) {
                await window.pingManager.pingNetworkServices(nfId);
            } else {
                console.error('❌ PingManager not available');
                alert('Ping functionality not available');
            }
        } catch (error) {
            console.error('❌ Network ping error:', error);
            if (window.logEngine) {
                window.logEngine.addLog(nfId, 'ERROR', `Network ping failed: ${error.message}`);
            }
        } finally {
            // Re-enable button
            if (btn) {
                btn.disabled = false;
                btn.textContent = '📡 Ping Network Services';
            }
        }
    }

    /**
     * Show ping history for NF
     * @param {string} nfId - NF ID
     */
    showPingHistory(nfId) {
        const nf = window.dataStore?.getNFById(nfId);
        if (!nf) return;

        if (!window.pingManager) {
            alert('Ping functionality not available');
            return;
        }

        const history = window.pingManager.getPingHistory(nfId);
        
        if (history.length === 0) {
            alert(`No ping history available for ${nf.name}\n\nExecute some ping commands first to see history.`);
            return;
        }

        let historyText = `═══════════════════════════════════\n`;
        historyText += `PING HISTORY FOR ${nf.name}\n`;
        historyText += `═══════════════════════════════════\n\n`;

        history.slice(-10).forEach((entry, index) => {
            const timestamp = new Date(entry.timestamp).toLocaleString();
            historyText += `${index + 1}. ${timestamp}\n`;
            historyText += `   Target: ${entry.targetIP}\n`;
            historyText += `   Result: ${entry.summary.received}/${entry.summary.sent} packets received (${entry.summary.lossPercentage}% loss)\n\n`;
        });

        historyText += `═══════════════════════════════════\n`;
        historyText += `Total ping sessions: ${history.length}\n`;
        historyText += `Showing last ${Math.min(10, history.length)} sessions\n`;
        historyText += `═══════════════════════════════════`;

        alert(historyText);
    }

    /**
     * Open Windows-style terminal for NF
     * @param {string} nfId - NF ID
     */
    openWindowsTerminal(nfId) {
        const nf = window.dataStore?.getNFById(nfId);
        if (!nf) return;

        // Create terminal modal
        this.createTerminalModal(nf);
    }

    /**
     * Create Windows-style terminal modal
     * @param {Object} nf - Network Function
     */
    createTerminalModal(nf) {
        // Remove existing terminal if any
        const existingTerminal = document.getElementById('windows-terminal-modal');
        if (existingTerminal) {
            existingTerminal.remove();
        }

        // Create terminal modal
        const terminalModal = document.createElement('div');
        terminalModal.id = 'windows-terminal-modal';
        terminalModal.className = 'windows-terminal-modal';
        
        terminalModal.innerHTML = `
            <div class="windows-terminal-window">
                <div class="windows-terminal-titlebar">
                    <div class="terminal-title">
                        <span class="terminal-icon">⬛</span>
                        Command Prompt - ${nf.name} (${nf.config.ipAddress})
                    </div>
                    <div class="terminal-controls">
                        <button class="terminal-btn close" id="terminal-close">×</button>
                    </div>
                </div>
                <div class="windows-terminal-content" id="terminal-content">
                    
                    <div class="terminal-output" id="terminal-output"></div>
                </div>
            </div>
        `;

        document.body.appendChild(terminalModal);

        // Setup terminal functionality
        this.setupWindowsTerminal(nf, terminalModal);

        // Show terminal with animation
        setTimeout(() => {
            terminalModal.classList.add('show');
        }, 10);
    }

    /**
     * Setup Windows terminal functionality
     * @param {Object} nf - Network Function
     * @param {HTMLElement} terminalModal - Terminal modal element
     */
    setupWindowsTerminal(nf, terminalModal) {
        const output = document.getElementById('terminal-output');
        const closeBtn = document.getElementById('terminal-close');
        const content = document.getElementById('terminal-content');
        
        let commandHistory = [];
        let historyIndex = -1;
        let currentInputLine = null;
        let cursorPosition = 0;
        let currentText = '';

        // Close button
        closeBtn.addEventListener('click', () => {
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

        // Update input display with cursor
        const updateInputDisplay = () => {
            if (!currentInputLine) return;
            const beforeCursor = currentText.slice(0, cursorPosition);
            const atCursor = currentText[cursorPosition] || '';
            const afterCursor = currentText.slice(cursorPosition + 1);
            
            currentInputLine.innerHTML = `
                <span class="terminal-prompt">C:\\${nf.name}></span>
                <span class="terminal-input-text">${beforeCursor}<span class="terminal-cursor-char">${atCursor || '█'}</span>${afterCursor}</span>
            `;
        };

        // Create input line for realistic terminal
        const createInputLine = () => {
            if (currentInputLine) {
                currentInputLine.remove();
            }

            const inputLine = document.createElement('div');
            inputLine.className = 'terminal-input-line';
            output.appendChild(inputLine);
            currentInputLine = inputLine;
            cursorPosition = 0;
            currentText = '';
            updateInputDisplay();
            
            output.scrollTop = output.scrollHeight;
            content.scrollTop = content.scrollHeight;
        };

        // Handle keyboard input
        const handleKeyInput = async (e) => {
            // Handle Ctrl+C for copy
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                const selectedText = window.getSelection().toString();
                if (selectedText) {
                    navigator.clipboard.writeText(selectedText).catch(err => console.error('Copy failed:', err));
                    return;
                }
            }

            // Handle Ctrl+V for paste
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                navigator.clipboard.readText().then(text => {
                    currentText = currentText.slice(0, cursorPosition) + text + currentText.slice(cursorPosition);
                    cursorPosition += text.length;
                    updateInputDisplay();
                }).catch(err => console.error('Paste failed:', err));
                return;
            }

            // Handle Ctrl+C to cancel current input (if no selection)
            if (e.ctrlKey && e.key === 'c') {
                e.preventDefault();
                if (currentInputLine) {
                    currentInputLine.innerHTML = `
                        <span class="terminal-prompt">C:\\${nf.name}></span>
                        <span class="terminal-input-text">${currentText}</span>
                    `;
                    currentInputLine.classList.add('terminal-command');
                    currentInputLine = null;
                }
                this.addTerminalLine(output, '^C', 'info');
                createInputLine();
                return;
            }

            // Handle Ctrl+L to clear screen
            if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                output.innerHTML = '';
                createInputLine();
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                const command = currentText.trim();
                
                if (currentInputLine) {
                    currentInputLine.innerHTML = `
                        <span class="terminal-prompt">C:\\${nf.name}></span>
                        <span class="terminal-input-text">${currentText}</span>
                    `;
                    currentInputLine.classList.add('terminal-command');
                    currentInputLine = null;
                }

                if (command) {
                    commandHistory.push(command);
                    historyIndex = commandHistory.length;
                    await this.processWindowsCommand(nf, command, output);
                }
                
                createInputLine();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    currentText = commandHistory[historyIndex] || '';
                    cursorPosition = currentText.length;
                    updateInputDisplay();
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    currentText = commandHistory[historyIndex] || '';
                    cursorPosition = currentText.length;
                    updateInputDisplay();
                } else {
                    historyIndex = commandHistory.length;
                    currentText = '';
                    cursorPosition = 0;
                    updateInputDisplay();
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (cursorPosition > 0) {
                    cursorPosition--;
                    updateInputDisplay();
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (cursorPosition < currentText.length) {
                    cursorPosition++;
                    updateInputDisplay();
                }
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                if (cursorPosition > 0) {
                    currentText = currentText.slice(0, cursorPosition - 1) + currentText.slice(cursorPosition);
                    cursorPosition--;
                    updateInputDisplay();
                }
            } else if (e.key === 'Delete') {
                e.preventDefault();
                if (cursorPosition < currentText.length) {
                    currentText = currentText.slice(0, cursorPosition) + currentText.slice(cursorPosition + 1);
                    updateInputDisplay();
                }
            } else if (e.key === 'Home') {
                e.preventDefault();
                cursorPosition = 0;
                updateInputDisplay();
            } else if (e.key === 'End') {
                e.preventDefault();
                cursorPosition = currentText.length;
                updateInputDisplay();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                const partial = currentText.toLowerCase().trim();
                if (!partial) return;

                // All available commands (no flags)
                const allCommands = [
                    'ping', 
                    'ifconfig', 'cls', 'clear', 'exit',
                    'dir', 'systeminfo', 'netstat', 'help'
                ];

                const matches = allCommands.filter(cmd => cmd.startsWith(partial));

                if (matches.length === 0) return;

                // Find common prefix across matches
                let commonPrefix = matches[0];
                for (let i = 1; i < matches.length; i++) {
                    let j = 0;
                    while (j < commonPrefix.length && j < matches[i].length && commonPrefix[j] === matches[i][j]) j++;
                    commonPrefix = commonPrefix.slice(0, j);
                }

                // Only fill up to the next word boundary
                const afterPartial = commonPrefix.slice(partial.length);
                const nextSpaceIdx = afterPartial.indexOf(' ');
                const fillTo = nextSpaceIdx === -1
                    ? commonPrefix
                    : partial + afterPartial.slice(0, nextSpaceIdx);

                if (fillTo.length > partial.length) {
                    currentText = fillTo;
                    cursorPosition = currentText.length;
                    updateInputDisplay();
                } else {
                    // Already at boundary — show all options
                    if (currentInputLine) {
                        currentInputLine.innerHTML = `
                            <span class="terminal-prompt">C:\\${nf.name}></span>
                            <span class="terminal-input-text">${currentText}</span>
                        `;
                        currentInputLine.classList.add('terminal-command');
                        currentInputLine = null;
                    }
                    this.addTerminalLine(output, matches.join('    '), 'info');
                    createInputLine();
                    currentText = partial;
                    cursorPosition = currentText.length;
                    updateInputDisplay();
                }
            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                currentText = currentText.slice(0, cursorPosition) + e.key + currentText.slice(cursorPosition);
                cursorPosition++;
                updateInputDisplay();
            }
        };

        document.addEventListener('keydown', handleKeyInput);
        terminalModal._keyHandler = handleKeyInput;

        // Initial welcome message
        this.addTerminalLine(output, '5G WIRELESS LAB', 'info');
        this.addTerminalLine(output, 'Type "help" for available commands.', 'info');
        createInputLine();
    }

    /**
     * Process Windows command
     * @param {Object} nf - Network Function
     * @param {string} command - Command to process
     * @param {HTMLElement} output - Output element
     */
    async processWindowsCommand(nf, command, output) {
        const cmd = command.toLowerCase().trim();
        const args = command.split(' ');

        if (cmd === 'help' || cmd === '?') {
            this.showWindowsHelp(output);
        } else if (cmd === 'ifconfig') {
            this.showIPConfig(nf, output);
        } else if (cmd.startsWith('ping ')) {
            const target = args[1];
            if (!target) {
                this.addTerminalLine(output, 'Usage: ping <hostname or IP address>', 'error');
            } else if (cmd === 'ping subnet' || !this.isValidIP(target)) {
                this.addTerminalLine(output, `'${command}' is not recognized as an internal or external command,`, 'error');
                this.addTerminalLine(output, 'operable program or batch file.', 'error');
            } else {
                await this.executeWindowsPing(nf, target, output);
            }
        } else if (cmd === 'cls' || cmd === 'clear') {
            output.innerHTML = '';
        } else if (cmd === 'exit') {
            const closeBtn = document.getElementById('terminal-close');
            if (closeBtn) closeBtn.click();
        } else if (cmd === 'systeminfo') {
            this.showSystemInfo(nf, output);
        } else if (cmd === 'netstat') {
            this.showNetstat(nf, output);
        } else if (cmd === '') {
            // Empty command, just show prompt
        } else {
            this.addTerminalLine(output, `'${command}' is not recognized as an internal or external command,`, 'error');
            this.addTerminalLine(output, 'operable program or batch file.', 'error');
        }

        this.addTerminalLine(output, '', 'blank');
    }

    /**
     * Add line to terminal output
     * @param {HTMLElement} output - Output element
     * @param {string} text - Text to add
     * @param {string} type - Line type (command, info, error, success, blank)
     */
    addTerminalLine(output, text, type = 'normal') {
        const line = document.createElement('div');
        line.className = `terminal-line terminal-${type}`;
        line.innerHTML = text || '&nbsp;';
        output.appendChild(line);
        
        // Auto-scroll to bottom
        output.scrollTop = output.scrollHeight;
    }

    /**
     * Show Windows help
     * @param {HTMLElement} output - Output element
     */
    showWindowsHelp(output) {
        const helpText = [
            'Available commands:',
            '',
            'HELP        - Display this help message',
            'IFCONFIG    - Display network configuration',
            'PING        - Test network connectivity',
            'SYSTEMINFO  - Display system information',
            'NETSTAT     - Display network connections',
            'CLS         - Clear the screen',
            'EXIT        - Close this terminal',
            ''
        ];

        helpText.forEach(line => {
            this.addTerminalLine(output, line, 'info');
        });
    }

    /**
     * Show IP configuration
     * @param {Object} nf - Network Function
     * @param {HTMLElement} output - Output element
     */
    showIPConfig(nf, output) {
        const lines = [
            'Windows IP Configuration',
            '',
            'Ethernet adapter Local Area Connection:',
            '',
            `   Connection-specific DNS Suffix  . : 5g.local`,
            `   IPv4 Address. . . . . . . . . . . : ${nf.config.ipAddress}`,
            `   Subnet Mask . . . . . . . . . . . : 255.255.255.0`,
            `   Default Gateway . . . . . . . . . : 192.168.1.1`,
            `   DNS Servers . . . . . . . . . . . : 8.8.8.8`,
            `                                       8.8.4.4`,
            ''
        ];

        lines.forEach(line => {
            this.addTerminalLine(output, line, 'info');
        });
    }

    /**
     * Execute Windows-style ping with subnet restrictions
     * @param {Object} nf - Network Function
     * @param {string} target - Target IP or hostname
     * @param {HTMLElement} output - Output element
     */
    async executeWindowsPing(nf, target, output) {
        // Validate IP
        if (!this.isValidIP(target)) {
            this.addTerminalLine(output, `Ping request could not find host ${target}. Please check the name and try again.`, 'error');
            return;
        }

        // Check subnet restriction FIRST
        const sourceNetwork = this.getNetworkFromIP(nf.config.ipAddress);
        const targetNetwork = this.getNetworkFromIP(target);
        
        if (sourceNetwork !== targetNetwork) {
            this.addTerminalLine(output, `Pinging ${target} with 32 bytes of data:`, 'info');
            this.addTerminalLine(output, '', 'blank');
            this.addTerminalLine(output, `PING: transmit failed. General failure.`, 'error');
            this.addTerminalLine(output, '', 'blank');
            this.addTerminalLine(output, `Network Error: Cannot reach ${target}`, 'error');
            this.addTerminalLine(output, `Source subnet: ${sourceNetwork}.0/24`, 'error');
            this.addTerminalLine(output, `Target subnet: ${targetNetwork}.0/24`, 'error');
            this.addTerminalLine(output, `Reason: Cross-subnet communication not allowed`, 'error');
            this.addTerminalLine(output, '', 'blank');
            this.addTerminalLine(output, `Ping statistics for ${target}:`, 'info');
            this.addTerminalLine(output, `    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),`, 'info');
            return;
        }

        // Initial ping message
        this.addTerminalLine(output, `Pinging ${target} with 32 bytes of data:`, 'info');
        this.addTerminalLine(output, '', 'blank');

        // Check if target is reachable (same subnet)
        const isReachable = this.isTargetReachable(nf, target);
        const results = [];

        // Send 4 ping packets with 0.5 second delays
        for (let i = 1; i <= 4; i++) {
            await this.delay(500); // 0.5 second delay

            if (isReachable) {
                const responseTime = this.generateResponseTime();
                const ttl = 255;
                
                results.push({
                    sequence: i,
                    time: responseTime,
                    ttl: ttl,
                    success: true
                });

                this.addTerminalLine(output, 
                    `Reply from ${target}: bytes=32 time=${responseTime}ms TTL=${ttl}`, 
                    'success'
                );
            } else {
                await this.delay(500); // Additional delay for timeout
                
                results.push({
                    sequence: i,
                    success: false,
                    timeout: true
                });

                this.addTerminalLine(output, 'Request timed out.', 'error');
            }
        }

        // Show statistics after final delay
        await this.delay(500);
        this.showPingStatistics(target, results, output);
    }

    /**
     * Execute ping subnet with detailed subnet information
     * @param {Object} nf - Network Function
     * @param {HTMLElement} output - Output element
     */
    async executeWindowsPingSubnet(nf, output) {
        const sourceNetwork = this.getNetworkFromIP(nf.config.ipAddress);
        const allNFs = window.dataStore?.getAllNFs() || [];
        
        // Find services in the same subnet only
        const sameSubnetServices = allNFs.filter(otherNf => 
            otherNf.id !== nf.id && 
            this.getNetworkFromIP(otherNf.config.ipAddress) === sourceNetwork
        );

        // Show subnet scan header
        this.addTerminalLine(output, `Subnet Scan: ${sourceNetwork}.0/24`, 'info');
        this.addTerminalLine(output, `Source: ${nf.name} (${nf.config.ipAddress})`, 'info');
        this.addTerminalLine(output, `Restriction: Only same-subnet services can be pinged`, 'info');
        this.addTerminalLine(output, '', 'blank');

        if (sameSubnetServices.length === 0) {
            this.addTerminalLine(output, `No other services found in subnet ${sourceNetwork}.0/24`, 'error');
            this.addTerminalLine(output, `Add more services with IPs in range ${sourceNetwork}.1-${sourceNetwork}.254`, 'info');
            return;
        }

        this.addTerminalLine(output, `Found ${sameSubnetServices.length} services in subnet ${sourceNetwork}.0/24:`, 'info');
        
        // List all services in subnet first
        sameSubnetServices.forEach(targetNf => {
            const statusIcon = targetNf.status === 'stable' ? '✅' : '⚠️';
            this.addTerminalLine(output, `  ${statusIcon} ${targetNf.name} (${targetNf.config.ipAddress}) [${targetNf.status.toUpperCase()}]`, 'info');
        });
        
        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, 'Starting connectivity tests...', 'info');
        this.addTerminalLine(output, '', 'blank');

        // Test each service
        for (const targetNf of sameSubnetServices) {
            const statusInfo = targetNf.status === 'stable' ? 'STABLE' : targetNf.status.toUpperCase();
            this.addTerminalLine(output, `Testing ${targetNf.name} (${targetNf.config.ipAddress}) [${statusInfo}]`, 'info');
            await this.executeWindowsPing(nf, targetNf.config.ipAddress, output);
            this.addTerminalLine(output, '', 'blank');
            await this.delay(200);
        }

        // Summary
        this.addTerminalLine(output, '═══════════════════════════════════════', 'info');
        this.addTerminalLine(output, `Subnet scan completed for ${sourceNetwork}.0/24`, 'success');
        this.addTerminalLine(output, `Total services tested: ${sameSubnetServices.length}`, 'info');
        this.addTerminalLine(output, `Stable services: ${sameSubnetServices.filter(nf => nf.status === 'stable').length}`, 'info');
        this.addTerminalLine(output, `Unstable services: ${sameSubnetServices.filter(nf => nf.status !== 'stable').length}`, 'info');
        this.addTerminalLine(output, '═══════════════════════════════════════', 'info');
    }

    /**
     * Show ping statistics
     * @param {string} target - Target IP
     * @param {Array} results - Ping results
     * @param {HTMLElement} output - Output element
     */
    showPingStatistics(target, results, output) {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const lossPercentage = Math.round((failed.length / results.length) * 100);

        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, `Ping statistics for ${target}:`, 'info');
        this.addTerminalLine(output, 
            `    Packets: Sent = ${results.length}, Received = ${successful.length}, Lost = ${failed.length} (${lossPercentage}% loss),`, 
            'info'
        );

        if (successful.length > 0) {
            const times = successful.map(r => r.time);
            const min = Math.min(...times);
            const max = Math.max(...times);
            const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

            this.addTerminalLine(output, 'Approximate round trip times in milli-seconds:', 'info');
            this.addTerminalLine(output, 
                `    Minimum = ${min}ms, Maximum = ${max}ms, Average = ${avg}ms`, 
                'info'
            );
        }
    }

    /**
     * Show directory listing
     * @param {HTMLElement} output - Output element
     */
   

    /**
     * Show system information
     * @param {Object} nf - Network Function
     * @param {HTMLElement} output - Output element
     */
    showSystemInfo(nf, output) {
        const uptime = window.nfManager?.getServiceUptime(nf) || 'Unknown';
        const lines = [
            'Host Name:                 ' + nf.name,
            'Network Card:              5G Service Interface',
            '                          Connection Name: Local Area Connection',
            `                          IP Address:      ${nf.config.ipAddress}`,
            `                          Port:            ${nf.config.port}`,
            `                          Protocol:        ${nf.config.httpProtocol}`,
            `System Up Time:            ${uptime}`,
            `Service Status:            ${nf.status.toUpperCase()}`,
            ''
        ];

        lines.forEach(line => {
            this.addTerminalLine(output, line, 'info');
        });
    }

    /**
     * Show network statistics
     * @param {Object} nf - Network Function
     * @param {HTMLElement} output - Output element
     */
    showNetstat(nf, output) {
        const connections = window.dataStore?.getConnectionsForNF(nf.id) || [];
        const busConnections = window.dataStore?.getBusConnectionsForNF(nf.id) || [];
        
        this.addTerminalLine(output, 'Active Connections', 'info');
        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, '  Proto  Local Address          Foreign Address        State', 'info');

        // Show direct connections
        connections.forEach(conn => {
            const otherNfId = conn.sourceId === nf.id ? conn.targetId : conn.sourceId;
            const otherNf = window.dataStore?.getNFById(otherNfId);
            if (otherNf) {
                this.addTerminalLine(output, 
                    `  TCP    ${nf.config.ipAddress}:${nf.config.port}         ${otherNf.config.ipAddress}:${otherNf.config.port}         ESTABLISHED`, 
                    'info'
                );
            }
        });

        // Show bus connections
        busConnections.forEach(busConn => {
            const bus = window.dataStore?.getBusById(busConn.busId);
            if (bus) {
                this.addTerminalLine(output, 
                    `  TCP    ${nf.config.ipAddress}:${nf.config.port}         ${bus.name}:BUS            ESTABLISHED`, 
                    'info'
                );
            }
        });

        if (connections.length === 0 && busConnections.length === 0) {
            this.addTerminalLine(output, '  No active connections.', 'info');
        }

        this.addTerminalLine(output, '', 'blank');
    }

    /**
     * Helper methods for terminal functionality
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isTargetReachable(sourceNf, targetIP) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const targetNf = allNFs.find(nf => nf.config.ipAddress === targetIP);
        
        if (!targetNf) {
            return Math.random() < 0.1; // 10% success for unknown IPs
        }

        const sourceNetwork = this.getNetworkFromIP(sourceNf.config.ipAddress);
        const targetNetwork = this.getNetworkFromIP(targetIP);
        
        if (sourceNetwork !== targetNetwork) {
            return Math.random() < 0.2; // 20% success for different networks
        }

        // Check if both services are stable
        if (sourceNf.status !== 'stable' || targetNf.status !== 'stable') {
            return Math.random() < 0.3; // 30% success if not both stable
        }

        return Math.random() < 0.9; // 90% success for stable same-network services
    }

    getNetworkFromIP(ip) {
        const parts = ip.split('.');
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }

    generateResponseTime() {
        const baseTime = Math.random() * 50 + 1;
        const variation = (Math.random() - 0.5) * 10;
        return Math.max(1, Math.round(baseTime + variation));
    }

    /**
     * Get next available IP address automatically
     * @returns {string} Next available IP address
     */
    getNextAvailableIP() {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const usedIPs = new Set(allNFs.map(nf => nf.config.ipAddress));
        
        // Define subnets in priority order
        const subnets = [
            '192.168.1', // Core network functions
            '192.168.2', // User plane functions  
            '192.168.3', // Edge services
            '192.168.4'  // Additional services
        ];

        // Find next available IP in priority order
        for (const subnet of subnets) {
            for (let host = 10; host <= 254; host++) {
                const ip = `${subnet}.${host}`;
                if (!usedIPs.has(ip)) {
                    console.log(`🌐 Auto-assigned next available IP: ${ip}`);
                    return ip;
                }
            }
        }

        // Fallback if all subnets are full
        const randomSubnet = Math.floor(Math.random() * 254) + 1;
        const randomHost = Math.floor(Math.random() * 244) + 10;
        const fallbackIP = `192.168.${randomSubnet}.${randomHost}`;
        
        console.warn(`⚠️ Using fallback IP: ${fallbackIP}`);
        return fallbackIP;
    }

    /**
     * Get next available port number automatically
     * @returns {number} Next available port number
     */
    getNextAvailablePort() {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const usedPorts = new Set(allNFs.map(nf => nf.config.port));
        
        // Find next available port starting from 8080
        for (let port = 8080; port <= 9999; port++) {
            if (!usedPorts.has(port)) {
                console.log(`🔌 Auto-assigned next available port: ${port}`);
                return port;
            }
        }

        // Fallback if all ports are used
        const randomPort = Math.floor(Math.random() * 1000) + 8000;
        console.warn(`⚠️ Using fallback port: ${randomPort}`);
        return randomPort;
    }

    /**
     * Validate IP address format
     * @param {string} ip - IP address to validate
     * @returns {boolean} True if valid IP
     */
    isValidIP(ip) {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    }

    /**
     * Check if NF type already exists in topology
     * @param {string} type - NF type to check
     * @returns {boolean} True if NF type already exists
     */
    isNFTypeAlreadyExists(type) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        return allNFs.some(nf => nf.type === type);
    }

    /**
     * Get bus at position (for clicking)
     */
    getBusAtPosition(x, y) {
        const allBuses = window.dataStore?.getAllBuses() || [];

        for (const bus of allBuses) {
            const tolerance = 30; // Increased for easier clicking

            if (bus.orientation === 'horizontal') {
                if (x >= bus.position.x &&
                    x <= bus.position.x + bus.length &&
                    Math.abs(y - bus.position.y) <= tolerance) {
                    return bus;
                }
            } else {
                if (y >= bus.position.y &&
                    y <= bus.position.y + bus.length &&
                    Math.abs(x - bus.position.x) <= tolerance) {
                    return bus;
                }
            }
        }

        return null;
    }
}