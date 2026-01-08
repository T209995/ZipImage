document.addEventListener('DOMContentLoaded', () => {
    // --- GESTION DES LANGUES ---
    const translations = {
        fr: {
            appName: "ZipImage",
            msgStart: "Cliquez pour lister les images.",
            btnExtract: "🔍 Lister",
            btnSelectAll: "Tout cocher",
            btnUnselectAll: "Tout décocher",
            btnDownload: "💾 Télécharger ZIP",
            msgExtracting: "Extraction en cours...",
            msgNoImages: "Aucune image valide trouvée.",
            msgFound: (count) => `Trouvé ${count} image(s).`,
            msgSelectOne: "Sélectionnez au moins une image.",
            msgDownloading: (current, total) => `Téléchargement... ${current}/${total}`,
            msgZipping: (count) => `Création du ZIP (${count} images)...`,
            msgFail: (count) => `Échec total (${count} erreurs). Vérifiez la console.`,
            msgSuccess: (success, fail) => `Terminé ! ${success} ok, ${fail} échecs.`,
            msgError: (err) => `Erreur : ${err}`
        },
        en: {
            appName: "ZipImage",
            msgStart: "Click to list images.",
            btnExtract: "🔍 Scan Page",
            btnSelectAll: "Select All",
            btnUnselectAll: "Unselect All",
            btnDownload: "💾 Download ZIP",
            msgExtracting: "Scanning in progress...",
            msgNoImages: "No valid images found.",
            msgFound: (count) => `Found ${count} image(s).`,
            msgSelectOne: "Please select at least one image.",
            msgDownloading: (current, total) => `Downloading... ${current}/${total}`,
            msgZipping: (count) => `Zipping (${count} images)...`,
            msgFail: (count) => `Total failure (${count} errors). Check console.`,
            msgSuccess: (success, fail) => `Done! ${success} ok, ${fail} failed.`,
            msgError: (err) => `Error: ${err}`
        }
    };

    let currentLang = localStorage.getItem('zipimage_lang') || 'fr';
    
    // Éléments UI Langue
    const btnFr = document.getElementById('btn-fr');
    const btnEn = document.getElementById('btn-en');

    function setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('zipimage_lang', lang);

        // Update UI Text Static
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[lang][key]) {
                el.textContent = translations[lang][key];
            }
        });

        // Changement de langue
        if (lang === 'fr') {
            btnFr.classList.add('active');
            btnEn.classList.remove('active');
        } else {
            btnEn.classList.add('active');
            btnFr.classList.remove('active');
        }

        const selectAllBtn = document.getElementById('select-all-button');
        if (selectAllBtn.style.display !== 'none') {
            const checkboxes = document.querySelectorAll('.image-checkbox');
            if (checkboxes.length > 0) {
                const allChecked = Array.from(checkboxes).every(c => c.checked);
                selectAllBtn.textContent = allChecked ? translations[lang].btnUnselectAll : translations[lang].btnSelectAll;
            }
        }
    }

    // Init Language
    setLanguage(currentLang);

    btnFr.addEventListener('click', () => setLanguage('fr'));
    btnEn.addEventListener('click', () => setLanguage('en'));

    // --- LOGIQUE PRINCIPALE ---

    const extractButton = document.getElementById('extract-button');
    const selectAllButton = document.getElementById('select-all-button');
    const message = document.getElementById('message');
    const imageListContainer = document.getElementById('image-list-container');
    const downloadSelectedButton = document.getElementById('download-selected-button');
    let allImages = [];

    const isValidUrl = (url) => {
        try {
            if (!url || url.startsWith('data:')) return false;
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch (e) {
            return false;
        }
    };

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper pour obtenir du texte traduit dynamiquement
    const t = (key, ...args) => {
        const val = translations[currentLang][key];
        if (typeof val === 'function') return val(...args);
        return val;
    };

    extractButton.addEventListener('click', async () => {
        message.textContent = t('msgExtracting');
        imageListContainer.innerHTML = '';
        downloadSelectedButton.style.display = 'none';
        selectAllButton.style.display = 'none';
        allImages = [];

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const injectionResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const images = document.querySelectorAll('img');
                    let urls = [];
                    Array.from(images).forEach(img => {
                        if (img.src) urls.push(img.src);
                    });
                    return [...new Set(urls)];
                }
            });

            const imageUrls = injectionResults[0].result;
            allImages = imageUrls.filter(isValidUrl);

            if (allImages.length === 0) {
                message.textContent = t('msgNoImages');
                return;
            }

            message.textContent = t('msgFound', allImages.length);

            allImages.forEach((url, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'image-wrapper';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `image-${index}`;
                checkbox.className = 'image-checkbox';
                checkbox.value = url;
                checkbox.checked = true;
                
                const label = document.createElement('label');
                label.htmlFor = `image-${index}`;
                label.textContent = url.length > 50 ? url.substring(0, 47) + '...' : url;
                label.title = url;

                wrapper.appendChild(checkbox);
                wrapper.appendChild(label);
                imageListContainer.appendChild(wrapper);
            });

            selectAllButton.style.display = 'inline-block';
            downloadSelectedButton.style.display = 'block';
            selectAllButton.textContent = t('btnUnselectAll');

        } catch (error) {
            console.error('Erreur script:', error);
            message.textContent = t('msgError', error.message);
        }
    });

    selectAllButton.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.image-checkbox');
        const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
        checkboxes.forEach(checkbox => checkbox.checked = !allChecked);
        selectAllButton.textContent = allChecked ? t('btnSelectAll') : t('btnUnselectAll');
    });

    downloadSelectedButton.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('.image-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            message.textContent = t('msgSelectOne');
            return;
        }

        const initialText = downloadSelectedButton.textContent;
        downloadSelectedButton.disabled = true;
        
        const zip = new JSZip();
        let successCount = 0;
        let failCount = 0;
        const total = selectedCheckboxes.length;
        
        const BATCH_SIZE = 5;
        const urlsToProcess = Array.from(selectedCheckboxes).map(cb => cb.value);

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = urlsToProcess.slice(i, i + BATCH_SIZE);
            
            message.textContent = t('msgDownloading', Math.min(i + BATCH_SIZE, total), total);

            const batchPromises = batch.map(url => {
                return fetch(url)
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        return response.blob().then(blob => ({ url, blob, mimeType: blob.type, status: 'success' }));
                    })
                    .catch(error => {
                        console.warn(`Erreur ${url}:`, error);
                        return { url, status: 'error' };
                    });
            });

            const results = await Promise.all(batchPromises);

            for (const result of results) {
                if (result.status === 'success') {
                    successCount++;
                    let filename = result.url.substring(result.url.lastIndexOf('/') + 1).split('?')[0].split('#')[0];
                    if (!filename || filename.length < 4 || !filename.includes('.')) {
                        const ext = result.mimeType.split('/')[1] || 'jpg';
                        filename = `image-${Date.now()}-${successCount}.${ext}`;
                    }
                    if (zip.file(filename)) {
                        filename = `copy-${Date.now()}-${filename}`;
                    }
                    zip.file(filename, result.blob);
                } else {
                    failCount++;
                }
            }

            await wait(100);
        }

        message.textContent = t('msgZipping', successCount);

        if (successCount === 0) {
             message.textContent = t('msgFail', failCount);
             downloadSelectedButton.disabled = false;
             downloadSelectedButton.textContent = initialText;
             return;
        }

        try {
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            
            chrome.downloads.download({
                url: url,
                filename: 'images_extraites.zip',
                saveAs: false
            }, () => {
                if (chrome.runtime.lastError) {
                    message.textContent = t('msgError', chrome.runtime.lastError.message);
                } else {
                    message.textContent = t('msgSuccess', successCount, failCount);
                }
                setTimeout(() => URL.revokeObjectURL(url), 10000);
                downloadSelectedButton.disabled = false;
                downloadSelectedButton.textContent = initialText;
            });
        } catch (zipError) {
            message.textContent = t('msgError', zipError.message);
            downloadSelectedButton.disabled = false;
            downloadSelectedButton.textContent = initialText;
        }
    });
});
