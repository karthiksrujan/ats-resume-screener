document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const apiStatusIndicator = document.getElementById('apiStatusIndicator');
    const apiStatusText = document.getElementById('apiStatusText');
    const templateButtons = document.getElementById('templateButtons');
    const jdInput = document.getElementById('jdInput');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const fileQueue = document.getElementById('fileQueue');
    const queueList = document.getElementById('queueList');
    const queueCount = document.getElementById('queueCount');
    const btnClearQueue = document.getElementById('btnClearQueue');
    const btnScreen = document.getElementById('btnScreen');
    const statusPanel = document.getElementById('statusPanel');
    const statusTitle = document.getElementById('statusTitle');
    const statusSubtitle = document.getElementById('statusSubtitle');
    const dashboardPanel = document.getElementById('dashboardPanel');
    const candidatesList = document.getElementById('candidatesList');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const candidateDrawer = document.getElementById('candidateDrawer');
    const btnCloseDrawer = document.getElementById('btnCloseDrawer');
    const drawerContent = document.getElementById('drawerContent');
    const btnExportCSV = document.getElementById('btnExportCSV');
    const btnExportJSON = document.getElementById('btnExportJSON');
    const toastContainer = document.getElementById('toastContainer');

    // Fit Filter Counters
    const countAll = document.getElementById('countAll');
    const countHighly = document.getElementById('countHighly');
    const countGood = document.getElementById('countGood');
    const countBorderline = document.getElementById('countBorderline');
    const countNotRec = document.getElementById('countNotRec');

    // State Variables
    let selectedFiles = [];
    let sampleJDs = {};
    let screenedCandidates = [];
    let activeFilter = 'all';

    // 1. Toast Notification Utility
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        // Remove toast after animation
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s reverse forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    }

    // 2. Fetch API Config (Check if Gemini LLM key is available)
    async function checkApiConfig() {
        try {
            const res = await fetch('/api/config');
            const data = await res.json();
            
            apiStatusIndicator.className = 'status-indicator active';
            apiStatusText.textContent = data.mode;
            if (data.has_gemini) {
                showToast("Connected to Gemini LLM Engine", "success");
            } else {
                showToast("Running in Local Heuristic Mode (TF-IDF)", "success");
            }
        } catch (err) {
            console.error("Backend offline", err);
            apiStatusIndicator.className = 'status-indicator warning';
            apiStatusText.textContent = "Offline (Local mode only)";
            showToast("Failed to connect to backend", "error");
        }
    }

    // 3. Load Sample JDs and Custom Templates
    let customTemplates = {};

    function renderTemplateButton(name) {
        const cleanKey = name.replace(/\s+/g, '_').toLowerCase();
        let btn = templateButtons.querySelector(`[data-jd="${cleanKey}"]`);
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-template';
            btn.dataset.jd = cleanKey;
            btn.textContent = name;
            btn.title = "Double click to delete this custom template";
            
            // Allow double-click to delete custom template
            btn.addEventListener('dblclick', () => {
                if (confirm(`Do you want to delete the custom template "${name}"?`)) {
                    delete customTemplates[cleanKey];
                    localStorage.setItem('custom_jds', JSON.stringify(customTemplates));
                    btn.remove();
                    showToast(`Deleted template "${name}"`, "success");
                    // If deleted active template, revert to software_engineer
                    if (btn.classList.contains('active')) {
                        const defaultBtn = templateButtons.querySelector('[data-jd="software_engineer"]');
                        if (defaultBtn) {
                            defaultBtn.click();
                        }
                    }
                }
            });
            
            templateButtons.appendChild(btn);
        }
    }

    function loadCustomTemplates() {
        try {
            const saved = localStorage.getItem('custom_jds');
            if (saved) {
                customTemplates = JSON.parse(saved);
                Object.keys(customTemplates).forEach(key => {
                    const name = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    renderTemplateButton(name);
                });
            }
        } catch (e) {
            console.error("Failed to load custom templates from localStorage", e);
        }
    }

    async function loadSampleJDs() {
        try {
            const res = await fetch('/api/sample-jds');
            sampleJDs = await res.json();
            
            // Remove skeleton loaders from template buttons
            const buttons = templateButtons.querySelectorAll('.btn-template');
            buttons.forEach(btn => {
                btn.classList.remove('skeleton');
            });
            
            // Load custom templates from localStorage
            loadCustomTemplates();
            
            // Set first sample as active by default
            if (sampleJDs['software_engineer']) {
                jdInput.value = sampleJDs['software_engineer'];
                document.querySelector('[data-jd="software_engineer"]')?.classList.add('active');
            }
        } catch (err) {
            console.error("Failed to load sample JDs", err);
            loadCustomTemplates();
        }
    }

    // Template Button Handlers
    templateButtons.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-template');
        if (!btn || btn.id === 'btnSaveCustomJD') return;
        
        templateButtons.querySelectorAll('.btn-template').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const jdKey = btn.dataset.jd;
        if (sampleJDs[jdKey]) {
            jdInput.value = sampleJDs[jdKey];
            showToast(`Loaded ${btn.textContent} template`, 'success');
        } else if (customTemplates[jdKey]) {
            jdInput.value = customTemplates[jdKey];
            showToast(`Loaded "${btn.textContent}" template`, 'success');
        }
    });

    // Save Current JD as Custom Template Handler
    const btnSaveCustomJD = document.getElementById('btnSaveCustomJD');
    btnSaveCustomJD.addEventListener('click', () => {
        const text = jdInput.value.trim();
        if (!text) {
            showToast("Please enter or paste a Job Description first.", "error");
            return;
        }
        
        const name = prompt("Enter a name for this Quick Template:", "SOC Intern");
        if (!name) return;
        
        const cleanName = name.trim();
        if (!cleanName) {
            showToast("Template name cannot be empty.", "error");
            return;
        }
        
        const jdKey = cleanName.replace(/\s+/g, '_').toLowerCase();
        
        if (['software_engineer', 'data_scientist', 'product_manager'].includes(jdKey)) {
            showToast("Cannot overwrite default templates.", "error");
            return;
        }
        
        customTemplates[jdKey] = text;
        
        try {
            localStorage.setItem('custom_jds', JSON.stringify(customTemplates));
            renderTemplateButton(cleanName);
            
            templateButtons.querySelectorAll('.btn-template').forEach(b => b.classList.remove('active'));
            const newBtn = templateButtons.querySelector(`[data-jd="${jdKey}"]`);
            if (newBtn) newBtn.classList.add('active');
            
            showToast(`Saved template "${cleanName}"`, "success");
        } catch (e) {
            showToast("Failed to save template locally: " + e.message, "error");
        }
    });

    // 4. File Drag & Drop Handlers
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    });

    function handleFiles(filesList) {
        for (let i = 0; i < filesList.length; i++) {
            const file = filesList[i];
            const ext = file.name.split('.').pop().toLowerCase();
            
            if (['pdf', 'docx', 'txt'].includes(ext)) {
                // Check if file is already added
                const alreadyExists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
                if (!alreadyExists) {
                    selectedFiles.push(file);
                }
            } else {
                showToast(`Unsupported format: ${file.name}`, 'error');
            }
        }
        updateQueueUI();
    }

    function updateQueueUI() {
        if (selectedFiles.length > 0) {
            fileQueue.style.display = 'flex';
            queueCount.textContent = selectedFiles.length;
            queueList.innerHTML = '';
            
            selectedFiles.forEach((file, index) => {
                const item = document.createElement('div');
                item.className = 'queue-item';
                
                // Format size
                const sizeKb = (file.size / 1024).toFixed(1);
                
                item.innerHTML = `
                    <div class="queue-item-name">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span>${file.name} (${sizeKb} KB)</span>
                    </div>
                    <button class="queue-item-remove" data-index="${index}">&times;</button>
                `;
                queueList.appendChild(item);
            });
        } else {
            fileQueue.style.display = 'none';
        }
    }

    // Remove individual file from queue
    queueList.addEventListener('click', (e) => {
        if (e.target.classList.contains('queue-item-remove')) {
            const index = parseInt(e.target.dataset.index);
            selectedFiles.splice(index, 1);
            updateQueueUI();
        }
    });

    // Clear all files
    btnClearQueue.addEventListener('click', () => {
        selectedFiles = [];
        updateQueueUI();
        showToast("Cleared file queue", "success");
    });

    // 5. Run screening pipeline
    btnScreen.addEventListener('click', async () => {
        const jd = jdInput.value.trim();
        if (!jd) {
            showToast("Please provide a Job Description.", "error");
            return;
        }
        if (selectedFiles.length === 0) {
            showToast("Please upload at least one resume.", "error");
            return;
        }

        // Show status panel and hide results
        statusPanel.style.display = 'flex';
        dashboardPanel.style.display = 'none';
        btnScreen.disabled = true;
        
        statusTitle.textContent = "Screening Candidates...";
        statusSubtitle.textContent = `Analyzing ${selectedFiles.length} resumes. Please wait.`;

        // Create multipart form data
        const formData = new FormData();
        formData.append('jd', jd);
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await fetch('/api/screen', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Screening pipeline failed.");
            }

            const data = await res.json();
            screenedCandidates = data.candidates;
            
            showToast(`Successfully screened ${screenedCandidates.length} resumes!`, 'success');
            renderDashboard();
            
        } catch (err) {
            showToast(err.message, 'error');
            console.error(err);
        } finally {
            statusPanel.style.display = 'none';
            btnScreen.disabled = false;
        }
    });

    // 6. Render Dashboard Results
    function renderDashboard() {
        dashboardPanel.style.display = 'block';
        
        // Update filter counters
        const counts = {
            all: screenedCandidates.length,
            highly: screenedCandidates.filter(c => c.tier === 'Highly Recommended').length,
            good: screenedCandidates.filter(c => c.tier === 'Good Fit').length,
            borderline: screenedCandidates.filter(c => c.tier === 'Borderline').length,
            notrec: screenedCandidates.filter(c => c.tier === 'Not Recommended').length
        };

        countAll.textContent = counts.all;
        countHighly.textContent = counts.highly;
        countGood.textContent = counts.good;
        countBorderline.textContent = counts.borderline;
        countNotRec.textContent = counts.notrec;

        // Apply filters & render
        filterCandidates(activeFilter);
    }

    // Filter Buttons Handlers
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            activeFilter = btn.dataset.filter;
            filterCandidates(activeFilter);
        });
    });

    function filterCandidates(filter) {
        let filtered = screenedCandidates;
        if (filter !== 'all') {
            filtered = screenedCandidates.filter(c => c.tier === filter);
        }

        candidatesList.innerHTML = '';
        
        if (filtered.length === 0) {
            candidatesList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    No candidates found in this tier.
                </div>
            `;
            return;
        }

        filtered.forEach((cand) => {
            // Find overall rank in global list (1-indexed)
            const globalRank = screenedCandidates.findIndex(c => c.candidate_name === cand.candidate_name) + 1;
            
            // Skill badges (top 4)
            const skillsHtml = cand.skills_extracted.slice(0, 4).map(s => `<span class="meta-pill">${s}</span>`).join('');
            
            const card = document.createElement('div');
            card.className = 'candidate-card';
            card.setAttribute('data-rank', globalRank);
            
            // Tier CSS class mapping
            let tierClass = 'notrec';
            if (cand.tier === 'Highly Recommended') tierClass = 'highly';
            else if (cand.tier === 'Good Fit') tierClass = 'good';
            else if (cand.tier === 'Borderline') tierClass = 'borderline';

            card.innerHTML = `
                <div class="rank-badge">${globalRank}</div>
                <div class="cand-info">
                    <h4>${cand.candidate_name}</h4>
                    <p>${cand.education_extracted}</p>
                    <div class="cand-meta-pills">
                        <span class="meta-pill" style="font-weight:600; color:var(--primary);">${cand.experience_years} Yrs Exp</span>
                        ${skillsHtml}
                    </div>
                </div>
                <div class="cand-score">
                    <div class="score-value">${cand.scores.total_score}%</div>
                    <div class="score-lbl">Match Score</div>
                </div>
                <div>
                    <span class="fit-badge ${tierClass}">${cand.tier}</span>
                </div>
            `;
            
            card.addEventListener('click', () => openCandidateDrawer(cand, globalRank));
            candidatesList.appendChild(card);
        });
    }

    // 7. Candidate Profile Drawer Handlers
    function openCandidateDrawer(cand, rank) {
        drawerOverlay.classList.add('active');
        candidateDrawer.classList.add('active');
        
        // Map tier class
        let tierClass = 'notrec';
        if (cand.tier === 'Highly Recommended') tierClass = 'highly';
        else if (cand.tier === 'Good Fit') tierClass = 'good';
        else if (cand.tier === 'Borderline') tierClass = 'borderline';

        // Format strengths, gaps, interview questions lists
        const strengthsHtml = cand.strengths.map(s => `<li>${s}</li>`).join('');
        const gapsHtml = cand.gaps.map(g => `<li>${g}</li>`).join('');
        const questionsHtml = cand.interview_questions.map(q => `<li>${q}</li>`).join('');
        
        // Extract skills pills
        const skillsPillsHtml = cand.skills_extracted.map(s => `<span class="profile-pill">${s}</span>`).join('');

        // Extract matched and missing keyword badges
        const matchedBadges = (cand.matched_keywords || []).map(s => `<span class="keyword-badge matched">✓ ${s}</span>`).join('');
        const missingBadges = (cand.missing_keywords || []).map(s => `<span class="keyword-badge missing">✗ ${s}</span>`).join('');

        drawerContent.innerHTML = `
            <div class="profile-header">
                <div class="profile-title">
                    <span class="fit-badge ${tierClass}" style="display:inline-block; margin-bottom:0.5rem;">Rank #${rank} — ${cand.tier}</span>
                    <h3>${cand.candidate_name}</h3>
                    <div class="profile-contact">
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                            ${cand.candidate_email}
                        </span>
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.194-4.174-6.996-7.001l1.293-.97c.362-.271.528-.732.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                            ${cand.candidate_phone}
                        </span>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div class="score-value" style="font-size:28px;">${cand.scores.total_score}%</div>
                    <div class="score-lbl" style="font-size:11px;">Suite Score</div>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 0.25rem;">Via ${cand.mode}</div>
                    <button type="button" class="btn-template" id="btnSaveToCRM" style="margin-top:0.75rem; padding:0.35rem 0.75rem; font-size:11px; display:inline-block; color:var(--primary); font-weight:700;">Save to Tracker</button>
                </div>
            </div>

            <!-- Score breakdown bars -->
            <div class="profile-section">
                <h4>Capability Fit Breakdown</h4>
                <div class="score-bars">
                    <div class="score-bar-item">
                        <div class="bar-lbl">
                            <span>Technical Skills Fit</span>
                            <span>${cand.scores.technical_skills}%</span>
                        </div>
                        <div class="bar-bg"><div class="bar-fill" data-width="${cand.scores.technical_skills}%"></div></div>
                    </div>
                    <div class="score-bar-item">
                        <div class="bar-lbl">
                            <span>Experience Relevance</span>
                            <span>${cand.scores.experience_relevance}%</span>
                        </div>
                        <div class="bar-bg"><div class="bar-fill" data-width="${cand.scores.experience_relevance}%"></div></div>
                    </div>
                    <div class="score-bar-item">
                        <div class="bar-lbl">
                            <span>Education & Certifications</span>
                            <span>${cand.scores.education_fit}%</span>
                        </div>
                        <div class="bar-bg"><div class="bar-fill" data-width="${cand.scores.education_fit}%"></div></div>
                    </div>
                    <div class="score-bar-item">
                        <div class="bar-lbl">
                            <span>Soft Skills & Leadership</span>
                            <span>${cand.scores.soft_skills}%</span>
                        </div>
                        <div class="bar-bg"><div class="bar-fill" data-width="${cand.scores.soft_skills}%"></div></div>
                    </div>
                </div>
            </div>

            <!-- Justification -->
            <div class="profile-section">
                <h4>Screening Rationale</h4>
                <p class="profile-text">${cand.justification}</p>
            </div>

            <!-- Extracted Skills & Keyword Matching -->
            <div class="profile-section">
                <h4>Extracted Keywords & Skills</h4>
                <div class="profile-pills" style="margin-bottom:0.75rem;">
                    ${skillsPillsHtml}
                </div>
                
                <h5 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.4rem; margin-top:0.8rem;">Keyword Matching Analysis</h5>
                <div class="keyword-badge-container">
                    ${matchedBadges || '<span style="font-size:11px; color:var(--text-muted);">No direct keyword matches.</span>'}
                    ${missingBadges}
                </div>
            </div>

            <!-- Education -->
            <div class="profile-section">
                <h4>Education & Academic Credentials</h4>
                <p class="profile-text" style="font-weight: 500;">${cand.education_extracted}</p>
            </div>

            <!-- Strengths / Gaps -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom:1.75rem;">
                <div>
                    <h4 style="font-size: 14px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Key Strengths</h4>
                    <ul class="bullet-list strengths-list">
                        ${strengthsHtml}
                    </ul>
                </div>
                <div>
                    <h4 style="font-size: 14px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Identified Gaps</h4>
                    <ul class="bullet-list gaps-list">
                        ${gapsHtml}
                    </ul>
                </div>
            </div>

            <!-- Suggested Interview Questions -->
            <div class="profile-section">
                <h4>Suggested Interview Questions</h4>
                <ul class="bullet-list questions-list">
                    ${questionsHtml}
                </ul>
            </div>

            <!-- Recruitment Communication Actions -->
            <div class="profile-section" style="border-top:1px solid rgba(0,0,0,0.05); padding-top:1.5rem; display:flex; gap:1rem;">
                <button type="button" class="btn-primary" id="btnInviteMail" style="flex:1; justify-content:center; padding:0.6rem;">Invite Candidate</button>
                <button type="button" class="btn-secondary" id="btnRejectMail" style="flex:1; justify-content:center; padding:0.6rem; color:var(--tier-notrec);">Send Rejection</button>
            </div>
        `;

        // Setup save handler
        document.getElementById('btnSaveToCRM').addEventListener('click', () => {
            saveCandidateToCRM(cand);
        });

        // Setup Invite mail handler
        document.getElementById('btnInviteMail').addEventListener('click', () => {
            sendCandidateEmail(cand.candidate_name, cand.candidate_email, 'invite', cand.scores.total_score);
        });

        // Setup Reject mail handler
        document.getElementById('btnRejectMail').addEventListener('click', () => {
            sendCandidateEmail(cand.candidate_name, cand.candidate_email, 'reject', cand.scores.total_score);
        });

        // Animate score bars
        setTimeout(() => {
            const fills = drawerContent.querySelectorAll('.bar-fill');
            fills.forEach(fill => {
                fill.style.width = fill.dataset.width;
            });
        }, 100);
    }

    function closeCandidateDrawer() {
        drawerOverlay.classList.remove('active');
        candidateDrawer.classList.remove('active');
    }

    btnCloseDrawer.addEventListener('click', closeCandidateDrawer);
    drawerOverlay.addEventListener('click', closeCandidateDrawer);

    // 8. Export Shortlist (CSV / JSON)
    btnExportCSV.addEventListener('click', () => {
        if (screenedCandidates.length === 0) return;
        
        let csvContent = "data:text/csv;charset=utf-8,";
        // Header
        csvContent += "Rank,Name,Fit Tier,Match Score %,Experience Years,Email,Phone,Education,Extracted Skills,Justification,Engine Mode\n";
        
        screenedCandidates.forEach((cand, index) => {
            const skills = cand.skills_extracted.join("; ");
            // Escape double quotes for CSV safety
            const row = [
                index + 1,
                `"${cand.candidate_name}"`,
                `"${cand.tier}"`,
                cand.scores.total_score,
                cand.experience_years,
                `"${cand.candidate_email}"`,
                `"${cand.candidate_phone}"`,
                `"${cand.education_extracted.replace(/"/g, '""')}"`,
                `"${skills.replace(/"/g, '""')}"`,
                `"${cand.justification.replace(/"/g, '""')}"`,
                `"${cand.mode}"`
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "ranked_candidates_shortlist.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Exported shortlist as CSV", "success");
    });

    btnExportJSON.addEventListener('click', () => {
        if (screenedCandidates.length === 0) return;
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(screenedCandidates, null, 2));
        const link = document.createElement("a");
        link.setAttribute("href", dataStr);
        link.setAttribute("download", "ranked_candidates_shortlist.json");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Exported shortlist as JSON", "success");
    });

    // ==========================================
    // ATS Resume Builder Module
    // ==========================================

    // Tabs Navigation Elements
    const tabScreener = document.getElementById('tabScreener');
    const tabGenerator = document.getElementById('tabGenerator');
    const screenerWorkspace = document.getElementById('screenerWorkspace');
    const generatorWorkspace = document.getElementById('generatorWorkspace');

    // Builder Inputs & Containers
    const builderName = document.getElementById('builderName');
    const builderEmail = document.getElementById('builderEmail');
    const builderPhone = document.getElementById('builderPhone');
    const builderLocation = document.getElementById('builderLocation');
    const builderLinkedin = document.getElementById('builderLinkedin');
    const builderSummary = document.getElementById('builderSummary');
    const builderSkills = document.getElementById('builderSkills');
    const experienceContainer = document.getElementById('experienceContainer');
    const educationContainer = document.getElementById('educationContainer');

    // Builder Buttons
    const btnAddExperience = document.getElementById('btnAddExperience');
    const btnAddEducation = document.getElementById('btnAddEducation');
    const btnGeneratePDF = document.getElementById('btnGeneratePDF');
    const btnGenerateDOCX = document.getElementById('btnGenerateDOCX');
    const btnLoadSampleBuilder = document.getElementById('btnLoadSampleBuilder');
    const btnResetBuilder = document.getElementById('btnResetBuilder');

    // Tab switching handlers
    tabScreener.addEventListener('click', () => {
        tabScreener.classList.add('active');
        tabGenerator.classList.remove('active');
        screenerWorkspace.style.display = 'grid';
        generatorWorkspace.style.display = 'none';
        showToast("Switched to Candidate Screener", "success");
    });

    tabGenerator.addEventListener('click', () => {
        tabGenerator.classList.add('active');
        tabScreener.classList.remove('active');
        generatorWorkspace.style.display = 'grid';
        screenerWorkspace.style.display = 'none';
        showToast("Switched to ATS Resume Builder", "success");
    });

    // Add work experience block
    function createExperienceRow(title = '', company = '', dates = '', location = '', desc = '') {
        const row = document.createElement('div');
        row.className = 'builder-item-row';
        row.innerHTML = `
            <button type="button" class="btn-delete-row">&times; Remove Job</button>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <input type="text" class="exp-title" placeholder="Job Title (e.g. Software Engineer)" value="${title}" style="background: var(--bg-base); box-shadow: var(--shadow-out-sm); border: none; border-radius: 8px; padding: 0.5rem; color: var(--text-primary); font-family: var(--font-body); font-size: 12px; outline: none;">
                <input type="text" class="exp-company" placeholder="Company Name" value="${company}" style="background: var(--bg-base); box-shadow: var(--shadow-out-sm); border: none; border-radius: 8px; padding: 0.5rem; color: var(--text-primary); font-family: var(--font-body); font-size: 12px; outline: none;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <input type="text" class="exp-dates" placeholder="Dates (e.g. Jan 2022 - Present)" value="${dates}" style="background: var(--bg-base); box-shadow: var(--shadow-out-sm); border: none; border-radius: 8px; padding: 0.5rem; color: var(--text-primary); font-family: var(--font-body); font-size: 12px; outline: none;">
                <input type="text" class="exp-location" placeholder="Location" value="${location}" style="background: var(--bg-base); box-shadow: var(--shadow-out-sm); border: none; border-radius: 8px; padding: 0.5rem; color: var(--text-primary); font-family: var(--font-body); font-size: 12px; outline: none;">
            </div>
            <textarea class="exp-desc" placeholder="Responsibilities & Accomplishments (one per line, e.g. - Developed REST APIs)" style="width: 100%; height: 60px; background: var(--bg-base); box-shadow: var(--shadow-out-sm); border: none; border-radius: 8px; padding: 0.5rem; color: var(--text-primary); font-family: var(--font-body); font-size: 12px; outline: none; resize: none;">${desc}</textarea>
        `;
        
        row.querySelector('.btn-delete-row').addEventListener('click', () => {
            row.remove();
            showToast("Removed job entry", "success");
        });
        
        experienceContainer.appendChild(row);
    }

    btnAddExperience.addEventListener('click', () => createExperienceRow());

    // Add education block
    function createEducationRow(degree = '', school = '', dates = '', location = '') {
        const row = document.createElement('div');
        row.className = 'builder-item-row';
        row.innerHTML = `
            <button type="button" class="btn-delete-row">&times; Remove School</button>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <input type="text" class="edu-degree" placeholder="Degree / Program (e.g. BS in CS)" value="${degree}" style="background: var(--bg-base); box-shadow: var(--shadow-out-sm); border: none; border-radius: 8px; padding: 0.5rem; color: var(--text-primary); font-family: var(--font-body); font-size: 12px; outline: none;">
                <input type="text" class="edu-school" placeholder="School / University" value="${school}" style="background: var(--bg-base); box-shadow: var(--shadow-out-sm); border: none; border-radius: 8px; padding: 0.5rem; color: var(--text-primary); font-family: var(--font-body); font-size: 12px; outline: none;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <input type="text" class="edu-dates" placeholder="Graduation Year / Dates" value="${dates}" style="background: var(--bg-base); box-shadow: var(--shadow-out-sm); border: none; border-radius: 8px; padding: 0.5rem; color: var(--text-primary); font-family: var(--font-body); font-size: 12px; outline: none;">
                <input type="text" class="edu-location" placeholder="Location" value="${location}" style="background: var(--bg-base); box-shadow: var(--shadow-out-sm); border: none; border-radius: 8px; padding: 0.5rem; color: var(--text-primary); font-family: var(--font-body); font-size: 12px; outline: none;">
            </div>
        `;
        
        row.querySelector('.btn-delete-row').addEventListener('click', () => {
            row.remove();
            showToast("Removed education entry", "success");
        });
        
        educationContainer.appendChild(row);
    }

    btnAddEducation.addEventListener('click', () => createEducationRow());

    // Get structured form data object
    function getBuilderData() {
        const nameVal = builderName.value.trim();
        if (!nameVal) {
            showToast("Please provide your Full Name.", "error");
            return null;
        }
        
        const experience = [];
        const expRows = experienceContainer.querySelectorAll('.builder-item-row');
        expRows.forEach(row => {
            experience.push({
                title: row.querySelector('.exp-title').value.trim(),
                company: row.querySelector('.exp-company').value.trim(),
                dates: row.querySelector('.exp-dates').value.trim(),
                location: row.querySelector('.exp-location').value.trim(),
                description: row.querySelector('.exp-desc').value.trim()
            });
        });

        const education = [];
        const eduRows = educationContainer.querySelectorAll('.builder-item-row');
        eduRows.forEach(row => {
            education.push({
                degree: row.querySelector('.edu-degree').value.trim(),
                school: row.querySelector('.edu-school').value.trim(),
                dates: row.querySelector('.edu-dates').value.trim(),
                location: row.querySelector('.edu-location').value.trim()
            });
        });

        return {
            name: nameVal,
            email: builderEmail.value.trim(),
            phone: builderPhone.value.trim(),
            location: builderLocation.value.trim(),
            linkedin: builderLinkedin.value.trim(),
            summary: builderSummary.value.trim(),
            skills: builderSkills.value.trim(),
            experience: experience,
            education: education
        };
    }

    // Call API and trigger browser download
    async function downloadGeneratedResume(format = 'pdf') {
        const resumeData = getBuilderData();
        if (!resumeData) return;
        
        const endpoint = format === 'pdf' ? '/api/generate-resume-pdf' : '/api/generate-resume-docx';
        
        showToast(`Compiling ATS ${format.toUpperCase()}...`, 'success');
        
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resumeData)
            });
            
            if (!res.ok) throw new Error("Failed to compile document.");
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${resumeData.name.replace(/\s+/g, '_')}_ATS_Resume.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            showToast(`Downloaded ATS ${format.toUpperCase()} successfully!`, 'success');
        } catch (err) {
            showToast("Failed to compile resume: " + err.message, 'error');
            console.error(err);
        }
    }

    btnGeneratePDF.addEventListener('click', () => downloadGeneratedResume('pdf'));
    btnGenerateDOCX.addEventListener('click', () => downloadGeneratedResume('docx'));

    // Demo data loader
    btnLoadSampleBuilder.addEventListener('click', () => {
        builderReset();
        
        builderName.value = "Alex Chen";
        builderEmail.value = "alex.chen@email.com";
        builderPhone.value = "+1 (555) 019-2834";
        builderLocation.value = "San Francisco, CA";
        builderLinkedin.value = "linkedin.com/in/alexchen";
        builderSummary.value = "Results-driven Software Engineer with 5+ years of experience designing and optimizing scalable backend REST APIs and microservices architectures. Expert in Python, FastAPI, and containerization pipelines.";
        builderSkills.value = "Python, FastAPI, PostgreSQL, Docker, Kubernetes, Git, React, REST APIs, AWS, System Design, Microservices";
        
        createExperienceRow(
            "Senior Backend Engineer",
            "TechCorp",
            "2022 - Present",
            "Remote",
            "- Designed and built microservices using Python and FastAPI\n- Optimized PostgreSQL query times by 40% using indexes and profiling\n- Implemented Docker containerization and Kubernetes orchestration workflows"
        );
        
        createExperienceRow(
            "Software Developer",
            "AppStart",
            "2020 - 2022",
            "San Francisco, CA",
            "- Developed REST APIs using Flask and worked on frontend modules in React\n- Managed database migrations and maintained Git collaborative structures"
        );

        createEducationRow(
            "Bachelor of Science in Computer Science",
            "Stanford University",
            "2020",
            "Stanford, CA"
        );
        
        showToast("Demo profile loaded", "success");
    });

    function builderReset() {
        builderName.value = '';
        builderEmail.value = '';
        builderPhone.value = '';
        builderLocation.value = '';
        builderLinkedin.value = '';
        builderSummary.value = '';
        builderSkills.value = '';
        experienceContainer.innerHTML = '';
        educationContainer.innerHTML = '';
    }

    // Global functions for CRM actions and Email drafting
    window.saveCandidateToCRM = function(cand) {
        fetch('/api/db/candidates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: cand.candidate_name,
                email: cand.candidate_email,
                phone: cand.candidate_phone,
                score: cand.scores.total_score,
                fit_tier: cand.tier,
                strengths: cand.strengths,
                gaps: cand.gaps,
                status: 'Screened'
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast(`Successfully saved ${cand.candidate_name} to CRM Database!`, "success");
            } else {
                showToast(`Failed to save to database: ${data.error}`, "error");
            }
        })
        .catch(err => {
            showToast("Database connection failed. Verify your MySQL server is running.", "error");
            console.error("DB Error:", err);
        });
    };

    window.sendCandidateEmail = function(name, email, action, score) {
        if (!email || email === 'N/A') {
            showToast("Candidate email is not available.", "error");
            return;
        }
        
        let subject = "";
        let body = "";
        
        if (action === 'invite') {
            subject = `Interview Invitation - Rooman AI recruitment`;
            body = `Dear ${name},

Thank you for your application. We reviewed your profile using our screening agent, and we are pleased to inform you that you have been shortlisted for an interview! (Match suitability score: ${score}%).

We would like to invite you for a 30-minute technical interview next week. Please let us know your availability.

Sincerely,
Recruiting Team`;
        } else {
            subject = `Application Update - Rooman AI recruitment`;
            body = `Dear ${name},

Thank you for your interest in the position and for taking the time to share your profile.

After careful review, we regret to inform you that we will not be moving forward with your application at this time. We will keep your resume on file for future opportunities.

We wish you all the best in your career search.

Sincerely,
Recruiting Team`;
        }
        
        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
        showToast(`Drafted email for ${name}`, "success");
    };

    const tabCRM = document.getElementById('tabCRM');
    const crmWorkspace = document.getElementById('crmWorkspace');
    const crmTableBody = document.getElementById('crmTableBody');
    const btnRefreshCRM = document.getElementById('btnRefreshCRM');

    // Register Tab CRM listener
    if (tabCRM) {
        tabCRM.addEventListener('click', () => {
            tabCRM.classList.add('active');
            tabScreener.classList.remove('active');
            tabGenerator.classList.remove('active');
            crmWorkspace.style.display = 'grid';
            screenerWorkspace.style.display = 'none';
            generatorWorkspace.style.display = 'none';
            loadCandidatesCRM();
            showToast("Switched to Saved Candidates Database", "success");
        });
    }

    if (btnRefreshCRM) {
        btnRefreshCRM.addEventListener('click', () => {
            loadCandidatesCRM();
        });
    }

    function loadCandidatesCRM() {
        crmTableBody.innerHTML = `<tr><td colspan="7" style="padding:2rem; text-align:center;">Loading candidates from MySQL...</td></tr>`;

        fetch('/api/db/candidates')
        .then(res => {
            if (!res.ok) throw new Error("Database fetch error.");
            return res.json();
        })
        .then(data => {
            if (data.success && data.candidates && data.candidates.length > 0) {
                crmTableBody.innerHTML = '';
                data.candidates.forEach(cand => {
                    const tr = document.createElement('tr');
                    
                    let tierClass = 'notrec';
                    if (cand.fit_tier === 'Highly Recommended') tierClass = 'highly';
                    else if (cand.fit_tier === 'Good Fit') tierClass = 'good';
                    else if (cand.fit_tier === 'Borderline') tierClass = 'borderline';

                    tr.innerHTML = `
                        <td style="padding:1rem; font-weight:600;">${cand.name}</td>
                        <td style="padding:1rem;">${cand.email}</td>
                        <td style="padding:1rem;">${cand.phone}</td>
                        <td style="padding:1rem; font-weight:700; color:var(--primary);">${cand.score}%</td>
                        <td style="padding:1rem;"><span class="fit-badge ${tierClass}" style="font-size:10px; padding:0.2rem 0.5rem;">${cand.fit_tier}</span></td>
                        <td style="padding:1rem;">
                            <select class="crm-status-select" data-id="${cand.id}">
                                <option value="Screened" ${cand.status === 'Screened' ? 'selected' : ''}>Screened</option>
                                <option value="Interviewing" ${cand.status === 'Interviewing' ? 'selected' : ''}>Interviewing</option>
                                <option value="Offered" ${cand.status === 'Offered' ? 'selected' : ''}>Offered</option>
                                <option value="Rejected" ${cand.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                            </select>
                        </td>
                        <td style="padding:1rem; text-align:right; display:flex; gap:0.5rem; justify-content:flex-end;">
                            <button type="button" class="btn-template btn-invite" style="padding:0.3rem 0.6rem; font-size:11px;">Invite</button>
                            <button type="button" class="btn-template btn-delete" style="padding:0.3rem 0.6rem; font-size:11px; color:var(--tier-notrec);">Delete</button>
                        </td>
                    `;

                    // Handle status change
                    tr.querySelector('.crm-status-select').addEventListener('change', (e) => {
                        updateCandidateStatusCRM(cand.id, e.target.value);
                    });

                    // Handle Invite mail
                    tr.querySelector('.btn-invite').addEventListener('click', () => {
                        sendCandidateEmail(cand.name, cand.email, 'invite', cand.score);
                    });

                    // Handle Delete
                    tr.querySelector('.btn-delete').addEventListener('click', () => {
                        if (confirm(`Are you sure you want to delete ${cand.name} from the database?`)) {
                            deleteCandidateCRM(cand.id);
                        }
                    });

                    crmTableBody.appendChild(tr);
                });
            } else {
                crmTableBody.innerHTML = `<tr><td colspan="7" style="padding:2rem; text-align:center; color:var(--text-muted);">No candidates saved yet. Screen resumes and save them to your tracker!</td></tr>`;
            }
        })
        .catch(err => {
            crmTableBody.innerHTML = `<tr><td colspan="7" style="padding:2rem; text-align:center; color:var(--tier-notrec); font-weight:600;">Failed to fetch database records. Make sure the database exists in phpMyAdmin!</td></tr>`;
            console.error("DB Fetch Error:", err);
        });
    }

    function updateCandidateStatusCRM(id, status) {
        fetch('/api/db/candidates', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: id, status: status })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast("Recruitment status updated successfully!", "success");
            } else {
                showToast(`Update failed: ${data.error}`, "error");
            }
        })
        .catch(err => {
            showToast("Database update connection failed.", "error");
            console.error("DB Update Error:", err);
        });
    }

    function deleteCandidateCRM(id) {
        fetch(`/api/db/candidates?id=${id}`, {
            method: 'DELETE'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast("Candidate deleted from tracker.", "success");
                loadCandidatesCRM();
            } else {
                showToast(`Delete failed: ${data.error}`, "error");
            }
        })
        .catch(err => {
            showToast("Database delete connection failed.", "error");
            console.error("DB Delete Error:", err);
        });
    }

    // Cover Letter generation click handlers
    const btnGenerateCL = document.getElementById('btnGenerateCL');
    const clTargetJD = document.getElementById('clTargetJD');
    const clResultContainer = document.getElementById('clResultContainer');
    const clResultText = document.getElementById('clResultText');
    const btnDownloadCLPDF = document.getElementById('btnDownloadCLPDF');

    if (btnGenerateCL) {
        btnGenerateCL.addEventListener('click', () => {
            const name = builderName.value.trim();
            const jd = clTargetJD.value.trim();
            
            if (!name) {
                showToast("Please enter your name in the Personal Information section first.", "error");
                return;
            }
            if (!jd) {
                showToast("Please paste the target Job Description to generate a cover letter.", "error");
                return;
            }

            // Gather qualifications summary from builder fields to assist the AI
            let qualifications = "";
            
            // Experience details
            const expRows = experienceContainer.querySelectorAll('.builder-item-row');
            if (expRows.length > 0) {
                qualifications += "\nWork Experience:\n";
                expRows.forEach(row => {
                    const title = row.querySelector('.exp-title').value;
                    const company = row.querySelector('.exp-company').value;
                    qualifications += `- ${title} at ${company}\n`;
                });
            }
            
            // Education details
            const eduRows = educationContainer.querySelectorAll('.builder-item-row');
            if (eduRows.length > 0) {
                qualifications += "\nEducation:\n";
                eduRows.forEach(row => {
                    const degree = row.querySelector('.edu-degree').value;
                    const school = row.querySelector('.edu-school').value;
                    qualifications += `- ${degree} from ${school}\n`;
                });
            }

            // Skills details
            const skills = builderSkills.value.trim();
            if (skills) {
                qualifications += `\nTechnical Skills: ${skills}\n`;
            }

            showToast("Generating tailored cover letter...", "info");
            btnGenerateCL.disabled = true;
            btnGenerateCL.innerText = "Generating...";

            fetch('/api/generate-cover-letter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    candidate_name: name,
                    jd: jd,
                    resume_text: qualifications || "A passionate engineering candidate looking for growth."
                })
            })
            .then(res => {
                if (!res.ok) throw new Error("Server error.");
                return res.json();
            })
            .then(data => {
                if (data.success && data.cover_letter) {
                    clResultText.value = data.cover_letter;
                    clResultContainer.style.display = 'flex';
                    showToast("Cover letter generated!", "success");
                } else {
                    showToast("Failed to generate cover letter.", "error");
                }
            })
            .catch(err => {
                showToast("Failed to connect to cover letter generator.", "error");
                console.error(err);
            })
            .finally(() => {
                btnGenerateCL.disabled = false;
                btnGenerateCL.innerText = "Generate Cover Letter";
            });
        });
    }

    if (btnDownloadCLPDF) {
        btnDownloadCLPDF.addEventListener('click', () => {
            const name = builderName.value.trim();
            const email = builderEmail.value.trim();
            const phone = builderPhone.value.trim();
            const text = clResultText.value.trim();

            if (!text) {
                showToast("No cover letter text to export.", "error");
                return;
            }

            showToast("Compiling Cover Letter PDF...", "info");
            
            fetch('/api/generate-cover-letter-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    phone: phone,
                    text: text
                })
            })
            .then(res => {
                if (!res.ok) throw new Error("Server compile error.");
                return res.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${name.replace(/\s+/g, '_')}_Cover_Letter.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                showToast("Cover Letter PDF downloaded successfully!", "success");
            })
            .catch(err => {
                showToast("Failed to generate PDF.", "error");
                console.error(err);
            });
        });
    }

    // Update existing tab handlers to remove CRM tab active styling when toggling
    tabScreener.addEventListener('click', () => {
        tabScreener.classList.add('active');
        tabGenerator.classList.remove('active');
        if (tabCRM) tabCRM.classList.remove('active');
        screenerWorkspace.style.display = 'grid';
        generatorWorkspace.style.display = 'none';
        if (crmWorkspace) crmWorkspace.style.display = 'none';
        showToast("Switched to Candidate Screener", "success");
    });

    tabGenerator.addEventListener('click', () => {
        tabGenerator.classList.add('active');
        tabScreener.classList.remove('active');
        if (tabCRM) tabCRM.classList.remove('active');
        generatorWorkspace.style.display = 'grid';
        screenerWorkspace.style.display = 'none';
        if (crmWorkspace) crmWorkspace.style.display = 'none';
        showToast("Switched to ATS Resume Builder", "success");
    });

    // Initialize App
    checkApiConfig();
    loadSampleJDs();
});
