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

    // 3. Load Sample JDs
    async function loadSampleJDs() {
        try {
            const res = await fetch('/api/sample-jds');
            sampleJDs = await res.json();
            
            // Remove skeleton loaders from template buttons
            const buttons = templateButtons.querySelectorAll('.btn-template');
            buttons.forEach(btn => {
                btn.classList.remove('skeleton');
            });
            
            // Set first sample as active by default
            if (sampleJDs['software_engineer']) {
                jdInput.value = sampleJDs['software_engineer'];
                document.querySelector('[data-jd="software_engineer"]')?.classList.add('active');
            }
        } catch (err) {
            console.error("Failed to load sample JDs", err);
        }
    }

    // Template Button Handlers
    templateButtons.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-template');
        if (!btn) return;
        
        templateButtons.querySelectorAll('.btn-template').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const jdKey = btn.dataset.jd;
        if (sampleJDs[jdKey]) {
            jdInput.value = sampleJDs[jdKey];
            showToast(`Loaded ${btn.textContent} template`, 'success');
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

            <!-- Extracted Skills -->
            <div class="profile-section">
                <h4>Extracted Keywords & Skills</h4>
                <div class="profile-pills">
                    ${skillsPillsHtml}
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

            <!-- Interview Questions -->
            <div class="profile-section">
                <h4>Suggested Interview Questions</h4>
                <ul class="bullet-list questions-list">
                    ${questionsHtml}
                </ul>
            </div>
        `;

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

    // Initialize App
    checkApiConfig();
    loadSampleJDs();
});
