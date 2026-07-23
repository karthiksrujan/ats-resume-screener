document.addEventListener('DOMContentLoaded', () => {
    // DOM Navigation Elements
    const navItems = {
        dashboard: document.getElementById('tabDashboard'),
        screener: document.getElementById('tabScreener'),
        crm: document.getElementById('tabCRM'),
        analytics: document.getElementById('tabAnalytics'),
        generator: document.getElementById('tabGenerator'),
        interviews: document.getElementById('tabInterviews'),
        settings: document.getElementById('tabSettings')
    };

    const views = {
        dashboard: document.getElementById('dashboardWorkspace'),
        screener: document.getElementById('screenerWorkspace'),
        crm: document.getElementById('crmWorkspace'),
        analytics: document.getElementById('analyticsWorkspace'),
        generator: document.getElementById('generatorWorkspace')
    };

    const toastContainer = document.getElementById('toastContainer');
    const templateButtons = document.getElementById('templateButtons');
    const jdInput = document.getElementById('jdInput');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const btnSelectFiles = document.getElementById('btnSelectFiles');
    const fileQueueContainer = document.getElementById('fileQueueContainer');
    const queueList = document.getElementById('queueList');
    const btnClearQueue = document.getElementById('btnClearQueue');
    const btnRunScreen = document.getElementById('btnRunScreen');
    const candidatesList = document.getElementById('candidatesList');
    const shortlistContainer = document.getElementById('shortlistContainer');

    const drawerOverlay = document.getElementById('drawerOverlay');
    const candidateDrawer = document.getElementById('candidateDrawer');
    const btnCloseDrawer = document.getElementById('btnCloseDrawer');
    const drawerContent = document.getElementById('drawerContent');

    // Dual Engine Toggles
    const btnEngineCognitive = document.getElementById('btnEngineCognitive');
    const btnEngineLocal = document.getElementById('btnEngineLocal');
    let currentEngine = 'cognitive';

    // State
    let selectedFiles = [];
    let sampleJDs = {};
    let screenedCandidates = [];
    let customTemplates = {};

    // 1. Toast Notification Utility
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s reverse forwards';
            setTimeout(() => { toast.remove(); }, 300);
        }, 3500);
    }

    // 2. Navigation Switcher
    function switchWorkspace(viewKey) {
        Object.keys(navItems).forEach(k => {
            if (navItems[k]) navItems[k].classList.remove('active');
        });
        Object.keys(views).forEach(k => {
            if (views[k]) views[k].classList.remove('active');
        });

        if (navItems[viewKey]) navItems[viewKey].classList.add('active');
        if (views[viewKey]) views[viewKey].classList.add('active');
        else if (views['dashboard']) views['dashboard'].classList.add('active');

        if (viewKey === 'crm') {
            loadCandidatesCRM();
        }
    }

    Object.keys(navItems).forEach(k => {
        if (navItems[k]) {
            navItems[k].addEventListener('click', () => switchWorkspace(k));
        }
    });

    // Quick Dashboard Launchers
    document.getElementById('btnLaunchScreening')?.addEventListener('click', () => switchWorkspace('screener'));
    document.getElementById('btnLaunchBuilder')?.addEventListener('click', () => switchWorkspace('generator'));
    document.getElementById('btnQuickCreateJob')?.addEventListener('click', () => {
        switchWorkspace('screener');
        jdInput.focus();
        showToast("Create a new Job Description to begin", "info");
    });
    document.getElementById('btnSeeAllReports')?.addEventListener('click', () => switchWorkspace('screener'));
    document.getElementById('linkViewPipeline')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchWorkspace('crm');
    });
    document.getElementById('btnAddCandidateHeader')?.addEventListener('click', () => switchWorkspace('generator'));
    document.getElementById('btnBulkMatch')?.addEventListener('click', () => switchWorkspace('screener'));

    // Dual Engine Toggle Event
    if (btnEngineCognitive && btnEngineLocal) {
        btnEngineCognitive.addEventListener('click', () => {
            btnEngineCognitive.classList.add('active');
            btnEngineLocal.classList.remove('active');
            currentEngine = 'cognitive';
            showToast("Switched to Cognitive LLM (Gemini 2.0)", "info");
        });
        btnEngineLocal.addEventListener('click', () => {
            btnEngineLocal.classList.add('active');
            btnEngineCognitive.classList.remove('active');
            currentEngine = 'local';
            showToast("Switched to Smart Local Heuristic Engine", "info");
        });
    }

    // 3. API Config Check
    async function checkApiConfig() {
        try {
            const res = await fetch('/api/config');
            const data = await res.json();
            if (data.has_gemini) {
                showToast("Connected to Gemini 2.0 Engine", "success");
            } else {
                showToast("Running in Local Heuristic Mode (TF-IDF)", "info");
            }
        } catch (err) {
            console.error("Backend offline", err);
        }
    }

    // 4. Sample JDs & Templates Loader
    async function loadSampleJDs() {
        try {
            const res = await fetch('/api/sample-jds');
            sampleJDs = await res.json();
            if (sampleJDs['software_engineer']) {
                jdInput.value = sampleJDs['software_engineer'];
            }
        } catch (err) {
            console.error("Failed to load sample JDs", err);
        }
    }

    if (templateButtons) {
        templateButtons.addEventListener('click', (e) => {
            const btn = e.target.closest('.pill-btn');
            if (!btn) return;
            templateButtons.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const jdKey = btn.dataset.jd;
            if (sampleJDs[jdKey]) {
                jdInput.value = sampleJDs[jdKey];
                showToast(`Loaded ${btn.textContent} template`, 'success');
            }
        });
    }

    // 5. Drag & Drop File Handlers
    if (dropzone && fileInput) {
        if (btnSelectFiles) btnSelectFiles.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = "var(--primary)";
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = "rgba(2, 132, 199, 0.3)";
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = "rgba(2, 132, 199, 0.3)";
            if (e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFiles(e.target.files);
            }
        });
    }

    function handleFiles(filesList) {
        for (let i = 0; i < filesList.length; i++) {
            const file = filesList[i];
            const ext = file.name.split('.').pop().toLowerCase();
            if (['pdf', 'docx', 'txt'].includes(ext)) {
                if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
                    selectedFiles.push(file);
                }
            } else {
                showToast(`Unsupported file: ${file.name}`, 'error');
            }
        }
        updateQueueUI();
    }

    function updateQueueUI() {
        if (selectedFiles.length > 0) {
            fileQueueContainer.style.display = 'block';
            queueList.innerHTML = '';
            selectedFiles.forEach((file, index) => {
                const sizeKb = (file.size / 1024).toFixed(1);
                const pill = document.createElement('div');
                pill.className = 'pill-btn';
                pill.style.display = 'inline-flex';
                pill.style.alignItems = 'center';
                pill.style.gap = '0.5rem';
                pill.style.margin = '0.25rem';
                pill.innerHTML = `
                    <span>📄 ${file.name} (${sizeKb} KB)</span>
                    <strong style="cursor:pointer; color:var(--tier-notrec);" data-index="${index}">&times;</strong>
                `;
                pill.querySelector('strong').addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedFiles.splice(index, 1);
                    updateQueueUI();
                });
                queueList.appendChild(pill);
            });
        } else {
            fileQueueContainer.style.display = 'none';
        }
    }

    if (btnClearQueue) {
        btnClearQueue.addEventListener('click', () => {
            selectedFiles = [];
            updateQueueUI();
            showToast("Cleared file queue", "success");
        });
    }

    // 6. Run Screening Pipeline Handler
    if (btnRunScreen) {
        btnRunScreen.addEventListener('click', async () => {
            const jd = jdInput.value.trim();
            if (!jd) {
                showToast("Please provide a Job Description.", "error");
                return;
            }
            if (selectedFiles.length === 0) {
                showToast("Please upload at least one candidate resume.", "error");
                return;
            }

            btnRunScreen.disabled = true;
            btnRunScreen.innerText = "Analyzing Resumes...";
            showToast("Running Screening Engine...", "info");

            const formData = new FormData();
            formData.append('jd', jd);
            selectedFiles.forEach(file => formData.append('files', file));

            try {
                const res = await fetch('/api/screen', {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) throw new Error("Screening failed.");
                const data = await res.json();
                screenedCandidates = data.candidates || [];

                showToast(`Successfully screened ${screenedCandidates.length} candidate(s)!`, 'success');

                if (screenedCandidates.length > 0) {
                    renderTopCandidate(screenedCandidates[0]);
                    renderShortlist();
                }
            } catch (err) {
                showToast("Screening error: " + err.message, "error");
            } finally {
                btnRunScreen.disabled = false;
                btnRunScreen.innerText = "Run Screen Pipeline >>";
            }
        });
    }

    // Render Inspection Card for Top Candidate
    function renderTopCandidate(cand) {
        const inspectName = document.getElementById('inspectName');
        const inspectTitle = document.getElementById('inspectTitle');
        const inspectScore = document.getElementById('inspectDonutScore');
        const donutStroke = document.getElementById('inspectDonutStroke');
        const fillTech = document.getElementById('fillTech');
        const fillExp = document.getElementById('fillExp');
        const fillEdu = document.getElementById('fillEdu');
        const fillSoft = document.getElementById('fillSoft');

        if (inspectName) inspectName.textContent = cand.candidate_name;
        if (inspectTitle) inspectTitle.textContent = cand.tier;
        if (inspectScore) inspectScore.textContent = `${cand.scores.total_score}%`;
        
        if (donutStroke) {
            const score = cand.scores.total_score;
            const offset = 314 - (314 * score / 100);
            donutStroke.style.strokeDashoffset = offset;
        }

        if (fillTech) fillTech.style.width = `${cand.scores.technical_skills}%`;
        if (fillExp) fillExp.style.width = `${cand.scores.experience_relevance}%`;
        if (fillEdu) fillEdu.style.width = `${cand.scores.education_fit}%`;
        if (fillSoft) fillSoft.style.width = `${cand.scores.soft_skills}%`;
    }

    function renderShortlist() {
        if (!shortlistContainer || !candidatesList) return;
        shortlistContainer.style.display = 'block';
        candidatesList.innerHTML = '';

        screenedCandidates.forEach((cand, idx) => {
            const item = document.createElement('div');
            item.className = 'match-item-card';
            item.innerHTML = `
                <div class="avatar-score">
                    <div class="avatar-thumb" style="background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px;">
                        ${cand.candidate_name.charAt(0)}
                    </div>
                    <span class="score-pill-green">${cand.scores.total_score}</span>
                </div>
                <div class="item-info">
                    <div class="item-title">#${idx + 1} ${cand.candidate_name}</div>
                    <div class="item-sub">${cand.tier} • ${cand.experience_years} Yrs Exp</div>
                </div>
                <button type="button" class="btn-template-sm">Inspect</button>
            `;
            item.addEventListener('click', () => openCandidateDrawer(cand, idx + 1));
            candidatesList.appendChild(item);
        });
    }

    // Demo Candidate Drawer Trigger
    window.openDemoCandidate = function(name) {
        switchWorkspace('analytics');
        showToast(`Inspecting match analysis for ${name}`, "info");
    };

    // Candidate Profile Drawer
    function openCandidateDrawer(cand, rank) {
        drawerOverlay.classList.add('active');
        candidateDrawer.classList.add('active');

        const matchedBadges = (cand.matched_keywords || []).map(s => `<span class="req-pill match"><span class="dot green"></span> ${s}</span>`).join('');
        const missingBadges = (cand.missing_keywords || []).map(s => `<span class="req-pill missing"><span class="dot red"></span> ${s}</span>`).join('');

        drawerContent.innerHTML = `
            <div class="page-title-header">
                <span class="status-pill status-offered" style="margin-bottom:0.5rem;">Rank #${rank} — ${cand.tier}</span>
                <h2>${cand.candidate_name}</h2>
                <p>${cand.candidate_email} • ${cand.candidate_phone}</p>
            </div>

            <div class="soft-card" style="margin-bottom:1rem;">
                <div class="flex-between">
                    <h3>Overall Suitability Score</h3>
                    <strong style="font-size:24px; color:var(--primary);">${cand.scores.total_score}%</strong>
                </div>
                <p style="font-size:12px; color:var(--text-muted); margin-top:0.4rem;">${cand.justification}</p>
            </div>

            <div class="soft-card" style="margin-bottom:1rem;">
                <h3>Keyword Analysis</h3>
                <div class="req-pills" style="margin-top:0.5rem;">
                    ${matchedBadges || '<span style="font-size:11px; color:var(--text-muted);">No direct matches</span>'}
                    ${missingBadges}
                </div>
            </div>

            <div class="soft-card" style="margin-bottom:1rem;">
                <h3>Key Strengths</h3>
                <ul style="padding-left:1.2rem; font-size:12px; color:var(--text-secondary); margin-top:0.4rem;">
                    ${cand.strengths.map(s => `<li>${s}</li>`).join('')}
                </ul>
            </div>

            <div style="display:flex; gap:0.5rem; margin-top:1.5rem;">
                <button type="button" class="btn-primary-pill" style="flex:1;" id="btnSaveToCRM">Save to Tracker</button>
                <button type="button" class="btn-secondary-pill" style="flex:1;" id="btnInviteMail">Invite Candidate</button>
            </div>
        `;

        document.getElementById('btnSaveToCRM')?.addEventListener('click', () => saveCandidateToCRM(cand));
        document.getElementById('btnInviteMail')?.addEventListener('click', () => sendCandidateEmail(cand.candidate_name, cand.candidate_email, 'invite', cand.scores.total_score));
    }

    function closeCandidateDrawer() {
        drawerOverlay.classList.remove('active');
        candidateDrawer.classList.remove('active');
    }

    if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeCandidateDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeCandidateDrawer);

    // 7. MySQL CRM Functions
    function loadCandidatesCRM() {
        const crmTableBody = document.getElementById('crmTableBody');
        if (!crmTableBody) return;

        crmTableBody.innerHTML = `<tr><td colspan="4" style="padding:1.5rem; text-align:center;">Loading candidates from MySQL database...</td></tr>`;

        fetch('/api/db/candidates')
        .then(res => res.json())
        .then(data => {
            if (data.success && data.candidates && data.candidates.length > 0) {
                crmTableBody.innerHTML = '';
                data.candidates.forEach(cand => {
                    const tr = document.createElement('tr');
                    let statusClass = 'status-screened';
                    if (cand.status === 'Offered') statusClass = 'status-offered';
                    else if (cand.status === 'Interviewing') statusClass = 'status-interviewing';
                    else if (cand.status === 'Rejected') statusClass = 'status-rejected';

                    tr.innerHTML = `
                        <td>
                            <div class="cand-profile-cell">
                                <div class="cand-avatar" style="background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px;">
                                    ${cand.name.charAt(0)}
                                </div>
                                <div>
                                    <div class="cand-name">${cand.name}</div>
                                    <div class="cand-sub">${cand.email}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <select class="crm-status-select pill-btn" data-id="${cand.id}">
                                <option value="Screened" ${cand.status === 'Screened' ? 'selected' : ''}>Screened</option>
                                <option value="Interviewing" ${cand.status === 'Interviewing' ? 'selected' : ''}>Interviewing</option>
                                <option value="Offered" ${cand.status === 'Offered' ? 'selected' : ''}>Offered</option>
                                <option value="Rejected" ${cand.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                            </select>
                        </td>
                        <td>
                            <div class="score-bar-inline">
                                <div class="bar-fill-inline bg-blue" style="width: ${cand.score}%;"></div>
                                <span>${cand.score}%</span>
                            </div>
                        </td>
                        <td style="text-align: right;">
                            <button type="button" class="btn-template-sm btn-invite">Invite</button>
                            <button type="button" class="btn-template-sm btn-delete" style="color:var(--tier-notrec); margin-left:0.25rem;">Delete</button>
                        </td>
                    `;

                    tr.querySelector('.crm-status-select').addEventListener('change', (e) => {
                        updateCandidateStatusCRM(cand.id, e.target.value);
                    });

                    tr.querySelector('.btn-invite').addEventListener('click', () => {
                        sendCandidateEmail(cand.name, cand.email, 'invite', cand.score);
                    });

                    tr.querySelector('.btn-delete').addEventListener('click', () => {
                        if (confirm(`Delete ${cand.name} from CRM database?`)) {
                            deleteCandidateCRM(cand.id);
                        }
                    });

                    crmTableBody.appendChild(tr);
                });
            } else {
                crmTableBody.innerHTML = `<tr><td colspan="4" style="padding:1.5rem; text-align:center; color:var(--text-muted);">No candidates saved in tracker. Screen resumes and save candidates!</td></tr>`;
            }
        })
        .catch(err => {
            crmTableBody.innerHTML = `<tr><td colspan="4" style="padding:1.5rem; text-align:center; color:var(--tier-notrec);">Database load error. Verify MySQL connection.</td></tr>`;
        });
    }

    function saveCandidateToCRM(cand) {
        fetch('/api/db/candidates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
                showToast(`Saved ${cand.candidate_name} to CRM Database!`, "success");
            } else {
                showToast(`Database error: ${data.error}`, "error");
            }
        });
    }

    function updateCandidateStatusCRM(id, status) {
        fetch('/api/db/candidates', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, status: status })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) showToast("Status updated", "success");
        });
    }

    function deleteCandidateCRM(id) {
        fetch(`/api/db/candidates?id=${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast("Candidate deleted", "success");
                loadCandidatesCRM();
            }
        });
    }

    window.sendCandidateEmail = function(name, email, action, score) {
        if (!email || email === 'N/A') {
            showToast("Candidate email unavailable", "error");
            return;
        }
        const subject = action === 'invite' ? `Interview Invitation - Rooman AI` : `Application Update - Rooman AI`;
        const body = `Dear ${name},\n\nWe evaluated your profile using Rooman AI (Match Score: ${score}%).\n\nSincerely,\nRecruiting Team`;
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        showToast(`Drafted email for ${name}`, "success");
    };

    // 8. ATS Resume Builder Downloads
    const btnGeneratePDF = document.getElementById('btnGeneratePDF');
    const btnGenerateDOCX = document.getElementById('btnGenerateDOCX');

    async function downloadResume(format) {
        const name = document.getElementById('builderName')?.value || "Alexander Sterling";
        const email = document.getElementById('builderEmail')?.value || "alex.sterling@techmail.com";
        const phone = document.getElementById('builderPhone')?.value || "+1 (555) 902-4431";
        const skills = document.getElementById('builderSkills')?.value || "AWS, Azure, GCP, Kubernetes, Docker";

        const resumeData = {
            name: name,
            email: email,
            phone: phone,
            location: "San Francisco, CA",
            linkedin: "linkedin.com/in/alexandersterling",
            summary: "Visionary Cloud Architect with over 10 years of experience in designing scalable, secure, and highly available distributed systems.",
            skills: skills,
            experience: [
                {
                    title: "Lead Cloud Engineer",
                    company: "Global Tech Solutions",
                    dates: "2019 - Present",
                    location: "San Francisco, CA",
                    description: "- Architected serverless microservices platform supporting 5M+ DAU.\n- Reduced cloud spend by $1.2M annually via automated right-sizing."
                }
            ],
            education: [
                {
                    degree: "Bachelor of Science in Computer Science",
                    school: "UC Berkeley",
                    dates: "2018",
                    location: "Berkeley, CA"
                }
            ]
        };

        const endpoint = format === 'pdf' ? '/api/generate-resume-pdf' : '/api/generate-resume-docx';
        showToast(`Compiling ATS ${format.toUpperCase()}...`, "info");

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resumeData)
            });

            if (!res.ok) throw new Error("Failed to compile resume.");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${name.replace(/\s+/g, '_')}_ATS_Resume.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            showToast(`Downloaded ATS ${format.toUpperCase()} successfully!`, "success");
        } catch (err) {
            showToast("Compile error: " + err.message, "error");
        }
    }

    if (btnGeneratePDF) btnGeneratePDF.addEventListener('click', () => downloadResume('pdf'));
    if (btnGenerateDOCX) btnGenerateDOCX.addEventListener('click', () => downloadResume('docx'));

    // Initialize Application
    checkApiConfig();
    loadSampleJDs();
});
