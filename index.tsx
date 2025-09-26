/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from "@google/genai";

// --- THEME TOGGLE LOGIC ---
const themeSwitch = document.getElementById('theme-switch') as HTMLInputElement;

// Function to set the theme state based on a boolean
function setTheme(isDark: boolean) {
    if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        themeSwitch.checked = true;
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        themeSwitch.checked = false;
    }
}

// Listener for the toggle switch
themeSwitch.addEventListener('change', () => {
    setTheme(themeSwitch.checked);
});

// Initial theme check on page load
function initializeTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedThemeIsDark = localStorage.getItem('theme') === 'dark';
    const noThemeSaved = !('theme' in localStorage);

    setTheme(savedThemeIsDark || (noThemeSaved && prefersDark));
}

initializeTheme(); // Apply theme on initial load
// --- END THEME TOGGLE LOGIC ---


// IMPORTANT: The API key is sourced from an environment variable.
// Ensure your build process replaces `process.env.API_KEY` with a valid key.
const API_KEY = process.env.API_KEY;
const ai = new GoogleGenAI({apiKey: API_KEY});

const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resultFlatlay = document.getElementById('result-flatlay');
const downloadFlatlayBtn = document.getElementById('download-flatlay-btn') as HTMLButtonElement;
const downloadAllBtn = document.getElementById('download-all-btn') as HTMLButtonElement;

// Custom character inputs
const heightInput = document.getElementById('height') as HTMLInputElement;
const weightInput = document.getElementById('weight') as HTMLInputElement;
const ageInput = document.getElementById('age') as HTMLInputElement;

// Photo Style inputs
const poseStyleSelect = document.getElementById('pose-style') as HTMLSelectElement;
const backgroundStyleSelect = document.getElementById('background-style') as HTMLSelectElement;
const additionalInstructionsTextarea = document.getElementById('additional-instructions') as HTMLTextAreaElement;
const watermarkToggle = document.getElementById('watermark-toggle') as HTMLButtonElement;
let isWatermarkEnabled = false;

// New upload section elements
const smallSlotsContainer = document.getElementById('small-slots-container');
const fullOutfitContainer = document.getElementById('full-outfit-container');
const fullOutfitInput = document.getElementById('full-outfit-input') as HTMLInputElement;
const fullOutfitPreview = document.getElementById('full-outfit-preview') as HTMLImageElement;
const fullOutfitPlaceholder = document.getElementById('full-outfit-placeholder');
const fullOutfitRemoveBtn = document.getElementById('full-outfit-remove-btn');

// Face upload elements
const faceUploadContainer = document.getElementById('face-upload-container');
const faceUploadInput = document.getElementById('face-upload-input') as HTMLInputElement;
const facePreview = document.getElementById('face-preview') as HTMLImageElement;
const facePlaceholder = document.getElementById('face-upload-placeholder');
const faceRemoveBtn = document.getElementById('face-remove-btn');

const maxImages = 8;
let uploadedFiles = [];
let uploadedFullOutfit = null;
let uploadedFace = null;
let selectedGender = 'Pria'; // Default selection
let successfulGenerations = { flatlay: false, model1: false, model2: false, model3: false, model4: false };

// SVG icons for the copy button
const COPY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
const COPIED_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>`;


function createUploadSlots() {
    const slotLabels = ["Atasan", "Bawahan", "Sepatu", "Aksesoris", "Tas", "Topi", "Luaran", "Terusan"];
    for (let i = 0; i < maxImages; i++) {
        const slot = document.createElement('div');
        slot.className = 'relative aspect-square file-input-container flex items-center justify-center cursor-pointer';
        slot.innerHTML = `
            <input type="file" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" data-index="${i}">
            <div class="text-center text-slate-500 dark:text-slate-400 p-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                <span class="text-xs mt-1 block">${slotLabels[i]}</span>
            </div>
            <img class="absolute inset-0 w-full h-full object-cover rounded-lg hidden" id="preview-${i}">
            <button class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hidden w-6 h-6 flex items-center justify-center text-xs" data-index="${i}">X</button>
        `;
        smallSlotsContainer.appendChild(slot);
    }
}

createUploadSlots();

function toggleUploadAvailability() {
    const hasSmallFiles = uploadedFiles.filter(Boolean).length > 0;
    const hasFullOutfitFile = uploadedFullOutfit !== null;

    // Toggle full outfit slot
    fullOutfitInput.disabled = hasSmallFiles;
    fullOutfitContainer.classList.toggle('opacity-50', hasSmallFiles);
    fullOutfitContainer.classList.toggle('cursor-not-allowed', hasSmallFiles);

    // Toggle small slots
    smallSlotsContainer.querySelectorAll('input[type="file"]').forEach((input: HTMLInputElement) => {
        input.disabled = hasFullOutfitFile;
    });
    smallSlotsContainer.classList.toggle('opacity-50', hasFullOutfitFile);
    smallSlotsContainer.classList.toggle('pointer-events-none', hasFullOutfitFile);
}

smallSlotsContainer.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.type === 'file' && input.files[0]) {
        const index = input.dataset.index;
        const reader = new FileReader();
        reader.onload = (event) => {
            (document.getElementById(`preview-${index}`) as HTMLImageElement).src = event.target.result as string;
            document.getElementById(`preview-${index}`).classList.remove('hidden');
            (input.nextElementSibling as HTMLElement).classList.add('hidden');
            (input.parentElement.querySelector('button') as HTMLElement).classList.remove('hidden');
            
            const base64String = (event.target.result as string).split(',')[1];
            uploadedFiles[index] = { inlineData: { data: base64String, mimeType: input.files[0].type } };
            toggleUploadAvailability();
        };
        reader.readAsDataURL(input.files[0]);
    }
});

smallSlotsContainer.addEventListener('click', (e) => {
     if ((e.target as HTMLElement).tagName === 'BUTTON') {
         const index = (e.target as HTMLElement).dataset.index;
         const container = (e.target as HTMLElement).parentElement;
         const input = container.querySelector('input[type="file"]') as HTMLInputElement;
         const preview = container.querySelector('img');
         const placeholder = container.querySelector('.text-center');

         input.value = '';
         preview.src = '';
         preview.classList.add('hidden');
         placeholder.classList.remove('hidden');
         (e.target as HTMLElement).classList.add('hidden');
         delete uploadedFiles[index];
         toggleUploadAvailability();
    }
});

fullOutfitInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        const reader = new FileReader();
        reader.onload = (event) => {
            fullOutfitPreview.src = event.target.result as string;
            fullOutfitPreview.classList.remove('hidden');
            fullOutfitPlaceholder.classList.add('hidden');
            fullOutfitRemoveBtn.classList.remove('hidden');

            const base64String = (event.target.result as string).split(',')[1];
            uploadedFullOutfit = { inlineData: { data: base64String, mimeType: target.files[0].type } };
            toggleUploadAvailability();
        };
        reader.readAsDataURL(target.files[0]);
    }
});

fullOutfitRemoveBtn.addEventListener('click', () => {
    fullOutfitInput.value = '';
    fullOutfitPreview.src = '';
    fullOutfitPreview.classList.add('hidden');
    fullOutfitPlaceholder.classList.remove('hidden');
    fullOutfitRemoveBtn.classList.add('hidden');
    uploadedFullOutfit = null;
    toggleUploadAvailability();
});

faceUploadInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        const reader = new FileReader();
        reader.onload = (event) => {
            facePreview.src = event.target.result as string;
            facePreview.classList.remove('hidden');
            facePlaceholder.classList.add('hidden');
            faceRemoveBtn.classList.remove('hidden');

            const base64String = (event.target.result as string).split(',')[1];
            uploadedFace = { inlineData: { data: base64String, mimeType: target.files[0].type } };
        };
        reader.readAsDataURL(target.files[0]);
    }
});

faceRemoveBtn.addEventListener('click', () => {
    faceUploadInput.value = '';
    facePreview.src = '';
    facePreview.classList.add('hidden');
    facePlaceholder.classList.remove('hidden');
    faceRemoveBtn.classList.add('hidden');
    uploadedFace = null;
});


document.getElementById('gender-selection').addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest('.gender-btn');
    if (!button) return;

    // FIX: Cast `button` to `HTMLElement` to access the `dataset` property.
    selectedGender = (button as HTMLElement).dataset.gender;

    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white', 'ring-2', 'ring-offset-2', 'ring-indigo-500', 'border-transparent');
        btn.classList.add('bg-white', 'text-gray-500', 'border-gray-300', 'dark:bg-slate-700', 'dark:border-slate-600', 'dark:text-slate-400');
    });

    button.classList.remove('bg-white', 'text-gray-500', 'border-gray-300', 'dark:bg-slate-700', 'dark:border-slate-600', 'dark:text-slate-400');
    button.classList.add('bg-indigo-600', 'text-white', 'ring-2', 'ring-offset-2', 'ring-indigo-500', 'border-transparent');
});

watermarkToggle.addEventListener('click', () => {
    isWatermarkEnabled = !isWatermarkEnabled;
    watermarkToggle.setAttribute('aria-checked', String(isWatermarkEnabled));
    const handle = watermarkToggle.querySelector('span:last-child');
    if (isWatermarkEnabled) {
        watermarkToggle.classList.replace('bg-gray-200', 'bg-indigo-600');
        watermarkToggle.classList.replace('dark:bg-slate-600', 'dark:bg-indigo-600');
        handle.classList.replace('translate-x-0', 'translate-x-5');
    } else {
        watermarkToggle.classList.replace('bg-indigo-600', 'bg-gray-200');
         watermarkToggle.classList.replace('dark:bg-indigo-600', 'dark:bg-slate-600');
        handle.classList.replace('translate-x-5', 'translate-x-0');
    }
});

['dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
    });
});

['dragover', 'dragleave'].forEach(eventName => {
    smallSlotsContainer.addEventListener(eventName, (e) => {
        if (eventName === 'dragover') {
            (e.currentTarget as HTMLElement).querySelectorAll('.file-input-container').forEach(c => c.classList.add('dragover'));
        } else {
            (e.currentTarget as HTMLElement).querySelectorAll('.file-input-container').forEach(c => c.classList.remove('dragover'));
        }
    });
});

smallSlotsContainer.addEventListener('drop', (e) => {
    (e.currentTarget as HTMLElement).querySelectorAll('.file-input-container').forEach(c => c.classList.remove('dragover'));
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        let emptySlotIndex = uploadedFiles.findIndex(f => !f);
        if (emptySlotIndex === -1) emptySlotIndex = 0;
        
        const input = smallSlotsContainer.querySelector(`input[data-index="${emptySlotIndex}"]`) as HTMLInputElement;
        if(input) {
            input.files = files;
            const changeEvent = new Event('change', { bubbles: true });
            input.dispatchEvent(changeEvent);
        }
    }
});

function showToast(message: string, duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Animate out and remove
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

function downloadImage(base64Data, filename) {
    try {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'image/png'});
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Download failed:", e);
        const imageUrl = `data:image/png;base64,${base64Data}`;
        window.open(imageUrl, '_blank');
    }
}

function updateResultUI(element, state, data = null) {
    const resultType = element.id.replace('result-', '').replace('model-', 'model'); 
    
    if (state === 'loading') {
        element.innerHTML = `
            <div class="w-full h-full shimmer"></div>
            <div class="absolute inset-x-0 bottom-4 text-center">
                <p id="loading-text-${resultType}" class="text-sm bg-black bg-opacity-40 text-white rounded-full px-3 py-1 inline-block transition-all duration-300">🔄 Menata produk…</p>
            </div>
        `;
    } else if (state === 'error') {
        element.innerHTML = `
            <div class="text-center text-red-500 p-4 flex flex-col items-center justify-center h-full">
                <span class="text-4xl mb-2">⚠️</span>
                <p>Oops! Gagal generate. Coba lagi dengan gambar lain</p>
            </div>
        `;
        successfulGenerations[resultType] = false;
    } else if (state === 'success') {
        const imageUrl = `data:image/png;base64,${data}`;
        element.innerHTML = `
            <img src="${imageUrl}" class="w-full h-full object-cover">
            <div class="absolute top-2 right-2 flex items-center gap-2">
                <button data-regenerate-id="${resultType}" title="Generate Ulang" class="regenerate-btn bg-black bg-opacity-40 text-white rounded-full p-2 hover:bg-opacity-60 transition">
                    <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-4.992-1.635v4.992m0 0h-4.992m4.992 0l-3.181-3.183a8.25 8.25 0 00-11.664 0l-3.181 3.183" /></svg>
                </button>
                <button data-fullscreen-src="${imageUrl}" title="Layar Penuh" class="fullscreen-btn bg-black bg-opacity-40 text-white rounded-full p-2 hover:bg-opacity-60 transition">
                    <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                </button>
                 <button data-video-prep-id="${resultType}" title="Siapkan untuk Video" class="video-prep-btn bg-black bg-opacity-40 text-white rounded-full p-2 hover:bg-opacity-60 transition">
                    <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1H3zm3.5 2.5a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2a.5.5 0 01.5-.5zM6 11a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2A.5.5 0 016 11zM9.5 5.5a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2a.5.5 0 01.5-.5zM9 11a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2a.5.5 0 01.5-.5zm3.5-5.5a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2a.5.5 0 01.5-.5zM12 11a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2a.5.5 0 01.5-.5zm3.5-5.5a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2a.5.5 0 01.5-.5zM15 11a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2a.5.5 0 01.5-.5z" /></svg>
                </button>
            </div>
        `;

        const downloadBtnId = resultType.startsWith('model') ? `download-model-btn-${resultType.slice(-1)}` : `download-flatlay-btn`;
        const downloadBtn = document.getElementById(downloadBtnId) as HTMLButtonElement;
        
        if (downloadBtn) {
            downloadBtn.dataset.base64 = data;
            downloadBtn.disabled = false;
            downloadBtn.classList.remove('bg-gray-300', 'text-gray-500', 'cursor-not-allowed', 'dark:bg-slate-700', 'dark:text-slate-400');
            downloadBtn.classList.add('bg-green-600', 'text-white', 'hover:bg-green-700', 'transform', 'hover:scale-105');
        }
        successfulGenerations[resultType] = true;
    }

    if (Object.values(successfulGenerations).some(s => s) && Object.values(successfulGenerations).every(s => s !== false || s === undefined)) {
        downloadAllBtn.disabled = false;
        downloadAllBtn.classList.remove('bg-gray-400', 'cursor-not-allowed', 'disabled:opacity-75', 'dark:bg-slate-700');
        downloadAllBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
    }
}

async function generateVideoPrompt(base64ImageData, textareaEl, copyBtnEl) {
    try {
        const imagePart = { inlineData: { data: base64ImageData, mimeType: 'image/png' } };
        const textPart = { text: 'Based on this image, create a short, descriptive prompt for an image-to-video AI model like Google VEO. The prompt should describe the person, their clothing, the background, and suggest a simple, subtle animation (like a gentle breeze, a slow smile, or a slight turn of the head). The output should be only the prompt text, nothing else, in English.' };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] }
        });
        
        const videoPrompt = response.text;
        textareaEl.value = videoPrompt;
        copyBtnEl.disabled = false;
    } catch (error) {
        console.error('Failed to generate video prompt:', error);
        textareaEl.value = 'Gagal membuat prompt video.';
    }
}

async function generateImageWithRetry(prompt, images, element, videoElements, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [{ text: prompt }, ...images] },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
            });
            
            let base64Data = null;
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    base64Data = part.inlineData.data;
                    break;
                }
            }

            if (!base64Data) throw new Error('No image data in API response.');
            
            updateResultUI(element, 'success', base64Data);
            if (videoElements) {
                await generateVideoPrompt(base64Data, videoElements.textarea, videoElements.copyBtn);
            }
            return;
        } catch (error) {
            console.error(`Attempt ${attempt + 1} for ${element.id} failed:`, error);
            attempt++;
            if (attempt >= maxRetries) {
                updateResultUI(element, 'error');
            } else {
                await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 1000));
            }
        }
    }
}

function resetState() {
    [downloadFlatlayBtn, ...Array.from(document.querySelectorAll('[id^="download-model-btn"]'))].forEach((btn: HTMLButtonElement) => {
        btn.classList.remove('bg-green-600', 'text-white', 'hover:bg-green-700', 'transform', 'hover:scale-105');
        btn.classList.add('bg-gray-300', 'text-gray-500', 'cursor-not-allowed', 'dark:bg-slate-700', 'dark:text-slate-400');
        btn.disabled = true;
        delete btn.dataset.base64;
    });

    [...Array.from(document.querySelectorAll('[id^="video-prompt-"]'))].forEach((textarea: HTMLTextAreaElement) => {
        textarea.value = 'Menunggu hasil gambar model...';
    });
    [...Array.from(document.querySelectorAll('.copy-prompt-btn'))].forEach((btn: HTMLButtonElement) => {
        btn.disabled = true;
    });
    
    downloadAllBtn.disabled = true;
    downloadAllBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
    downloadAllBtn.classList.add('bg-gray-400', 'cursor-not-allowed', 'disabled:opacity-75', 'dark:bg-slate-700');
    successfulGenerations = { flatlay: false, model1: false, model2: false, model3: false, model4: false };
}

function buildModelPrompt() {
    const heightVal = heightInput.value || '170';
    const weightVal = weightInput.value || '60';
    const ageVal = ageInput.value || '25';
    const pose = poseStyleSelect.value;
    const background = backgroundStyleSelect.value;
    const instructions = additionalInstructionsTextarea.value;
    const watermarkInstruction = isWatermarkEnabled ? `\n- Watermark: Add a subtle, semi-transparent watermark with the text "Khusni'ah Shop" at the bottom-right corner.` : '';
    
    const faceInstruction = uploadedFace
        ? `- Face Reference: Use the additionally provided image as a strong reference for the model's facial features, ensuring the generated face is highly consistent with it.`
        : `- Face: Include a realistic face with natural Indonesian features: medium-dark hair, brown to tan skin tones, and a natural Asian facial structure. The face must be AI-generated, generic, and not resemble any specific real person or celebrity.`;

    let modelPrompt = `Generate a photorealistic try-on image:
- Model: An Indonesian {{gender}} model, approximately {{age}} years old.
- Pose: The model should be in a {{pose}} pose.
${faceInstruction}
- Expression: A natural and relatable expression, either neutral or a slight smile.
- Body Details: Height approximately {{height}} cm, weight approximately {{weight}} kg.
- Image Style: 9:16 portrait aspect ratio.
- Environment: The background should be {{background}}.
- Clothing: The uploaded clothing items must fit the model perfectly, with accurate fabric textures, colors, and drape.
${instructions ? `- Additional Instructions: ${instructions}`: ''}${watermarkInstruction}`;
    
    return modelPrompt.replace('{{gender}}', selectedGender)
                      .replace('{{age}}', ageVal)
                      .replace('{{height}}', heightVal)
                      .replace('{{weight}}', weightVal)
                      .replace('{{pose}}', pose)
                      .replace('{{background}}', background);
}

function getImagesForModel() {
    const images = uploadedFullOutfit ? [uploadedFullOutfit] : uploadedFiles.filter(Boolean);
    if (uploadedFace) {
        images.push(uploadedFace);
    }
    return images;
}


generateBtn.addEventListener('click', async () => {
    const validImages = uploadedFiles.filter(Boolean);

    if (validImages.length === 0 && !uploadedFullOutfit) {
         if(typeof alert !== 'undefined') alert("Silakan unggah setidaknya satu gambar produk atau satu outfit lengkap.");
        return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = 'Memproses...';
    resetState();
    
    const loadingMessages = ['✨ Styling model…', '💡 Finishing lighting…', '🔄 Menata produk…'];
    let messageIndex = 0;
    const loadingInterval = setInterval(() => {
        const newMessage = loadingMessages[messageIndex];
        document.querySelectorAll('[id^="loading-text-"]').forEach((el: HTMLElement) => {
            el.textContent = newMessage;
        });
        messageIndex = (messageIndex + 1) % loadingMessages.length;
    }, 2000);

    let flatlayPromise;
    const modelPromises = [];
    const imagesForModel = getImagesForModel();

    if (uploadedFullOutfit) {
        resultFlatlay.innerHTML = `<div class="text-center text-gray-500 dark:text-slate-400 p-4 flex flex-col items-center justify-center h-full"><span class="text-2xl mb-2">ℹ️</span><p>Flat lay tidak tersedia untuk unggahan outfit lengkap.</p></div>`;
        successfulGenerations.flatlay = true; // Mark as "successful" to not block download all
        flatlayPromise = Promise.resolve();
    } else {
        const watermarkInstruction = isWatermarkEnabled ? `\n- Watermark: Add a subtle, semi-transparent watermark with the text "Khusni'ah Shop" at the bottom-right corner.` : '';
        const flatlayPrompt = `Generate a photorealistic flat lay of the uploaded items. Aspect ratio 9:16, top-down angle, neat arrangement, neutral clean background.${watermarkInstruction}`;
        updateResultUI(resultFlatlay, 'loading');
        flatlayPromise = generateImageWithRetry(flatlayPrompt, validImages, resultFlatlay, null);
    }
    
    const modelPrompt = buildModelPrompt();

    for (let i = 1; i <= 4; i++) {
        const resultModelEl = document.getElementById(`result-model-${i}`);
        const videoTextareaEl = document.getElementById(`video-prompt-${i}`) as HTMLTextAreaElement;
        const copyBtnEl = document.querySelector(`button[data-target="video-prompt-${i}"]`) as HTMLButtonElement;
        
        updateResultUI(resultModelEl, 'loading');
        modelPromises.push(generateImageWithRetry(modelPrompt, imagesForModel, resultModelEl, { textarea: videoTextareaEl, copyBtn: copyBtnEl }));
    }

    try {
        await Promise.all([flatlayPromise, ...modelPromises]);
    } finally {
        clearInterval(loadingInterval);
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Mockup';
    }
});

document.querySelectorAll('[id^="download-"]').forEach(btn => {
    btn.addEventListener('click', () => {
        const button = btn as HTMLButtonElement;
        if (button.dataset.base64 && !button.disabled) {
            downloadImage(button.dataset.base64, button.dataset.filename);
        }
    });
});

downloadAllBtn.addEventListener('click', () => {
    if (!downloadAllBtn.disabled) {
        let delay = 0;
        document.querySelectorAll('[id^="download-"][data-base64]').forEach((btn: HTMLButtonElement) => {
            if (!btn.disabled) {
                setTimeout(() => btn.click(), delay);
                delay += 200;
            }
        });
    }
});

// --- MODAL & INTERACTIVE BUTTONS LOGIC ---
const fullscreenModal = document.getElementById('fullscreen-modal');
const fullscreenImage = document.getElementById('fullscreen-image') as HTMLImageElement;
const modalCloseBtn = document.getElementById('modal-close-btn');

function closeModal() {
    fullscreenModal.classList.add('hidden');
}
modalCloseBtn.addEventListener('click', closeModal);
fullscreenModal.addEventListener('click', (e) => {
    if (e.target === fullscreenModal) { 
        closeModal();
    }
});

document.getElementById('output-section').addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;

    // --- Copy Button ---
    const copyButton = target.closest('.copy-prompt-btn');
    if (copyButton) {
        const textareaId = (copyButton as HTMLElement).dataset.target;
        const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
        if (textarea && !copyButton.hasAttribute('disabled')) {
            navigator.clipboard.writeText(textarea.value).then(() => {
                copyButton.innerHTML = COPIED_ICON_SVG;
                copyButton.classList.remove('highlight-pulse');
                setTimeout(() => { 
                    const originalIconContainer = document.createElement('div');
                    originalIconContainer.innerHTML = COPY_ICON_SVG;
                    copyButton.innerHTML = '';
                    copyButton.appendChild(originalIconContainer.firstChild);
                 }, 2000);
            });
        }
    }

    // --- Fullscreen Button ---
    const fullscreenButton = target.closest('.fullscreen-btn');
    if (fullscreenButton) {
        const imageUrl = fullscreenButton.getAttribute('data-fullscreen-src');
        if (imageUrl) {
            fullscreenImage.src = imageUrl;
            fullscreenModal.classList.remove('hidden');
        }
    }

    // --- Prepare for Video Button ---
    const videoPrepButton = target.closest('.video-prep-btn');
    if (videoPrepButton) {
        const resultType = videoPrepButton.getAttribute('data-video-prep-id');
        const isFlatlay = resultType === 'flatlay';
        if (isFlatlay) {
            showToast('Fungsi video hanya untuk gambar model.', 5000);
            return;
        }

        const resultElement = videoPrepButton.closest('.relative').parentElement;
        const imageElement = resultElement.querySelector('img');
        
        if (imageElement && imageElement.src) {
            try {
                const response = await fetch(imageElement.src);
                const blob = await response.blob();
                await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                ]);

                const videoAppUrl = 'https://aistudio.google.com/apps/drive/1AwifuKLUePJSpzfyiMJ3ib-oJDuzmM-1?showPreview=true&showAssistant=true';
                window.open(videoAppUrl, '_blank');
                
                showToast('✅ Gambar disalin! Paste di tab baru & salin prompt di bawah.');

                const modelNumber = resultType.slice(-1);
                const copyPromptBtn = document.querySelector(`button[data-target="video-prompt-${modelNumber}"]`);
                if (copyPromptBtn) {
                    copyPromptBtn.classList.add('highlight-pulse');
                    setTimeout(() => copyPromptBtn.classList.remove('highlight-pulse'), 8000);
                }

            } catch (err) {
                console.error('Failed to copy image: ', err);
                showToast('Gagal menyalin gambar. Coba lagi.', 5000);
            }
        }
    }

    // --- Regenerate Button ---
    const regenerateButton = target.closest('.regenerate-btn');
    if (regenerateButton && !generateBtn.disabled) {
        const resultId = regenerateButton.getAttribute('data-regenerate-id'); // e.g., 'flatlay', 'model1'
        const isFlatlay = resultId === 'flatlay';
        const elementId = isFlatlay ? 'result-flatlay' : `result-model-${resultId.slice(-1)}`;
        const element = document.getElementById(elementId);

        if (!element) return;
        
        generateBtn.disabled = true;
        generateBtn.textContent = 'Memproses...';
        document.querySelectorAll('.regenerate-btn, .fullscreen-btn, .video-prep-btn').forEach((b : HTMLElement) => b.style.pointerEvents = 'none');
        
        updateResultUI(element, 'loading');

        try {
            if (isFlatlay) {
                const validImages = uploadedFiles.filter(Boolean);
                if (validImages.length > 0) {
                     const watermarkInstruction = isWatermarkEnabled ? `\n- Watermark: Add a subtle, semi-transparent watermark with the text "Khusni'ah Shop" at the bottom-right corner.` : '';
                     const flatlayPrompt = `Generate a photorealistic flat lay of the uploaded items. Aspect ratio 9:16, top-down angle, neat arrangement, neutral clean background.${watermarkInstruction}`;
                    await generateImageWithRetry(flatlayPrompt, validImages, element, null);
                }
            } else { // It's a model
                const modelNumber = resultId.slice(-1);
                const videoTextareaEl = document.getElementById(`video-prompt-${modelNumber}`) as HTMLTextAreaElement;
                const copyBtnEl = document.querySelector(`button[data-target="video-prompt-${modelNumber}"]`) as HTMLButtonElement;
                const modelPrompt = buildModelPrompt();
                const imagesForModel = getImagesForModel();
                await generateImageWithRetry(modelPrompt, imagesForModel, element, { textarea: videoTextareaEl, copyBtn: copyBtnEl });
            }
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Mockup';
            document.querySelectorAll('.regenerate-btn, .fullscreen-btn, .video-prep-btn').forEach((b: HTMLElement) => b.style.pointerEvents = 'auto');
        }
    }
});