// On importe les fonctions nécessaires de Firebase Firestore
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";

// Initialisation de Firestore
// L'application Firebase est déjà initialisée dans le bloc <script type="module"> de l'HTML.
const app = getApp();
const db = getFirestore(app);
const COLLECTION_NAME = 'characters'; 

let allInputs; 

// --- CONFIGURATION D'ID FONDAMENTALE (Correspondant à votre HTML) ---
const ABILITIES_TAB_ID = 'tab-abilities'; // L'onglet "Capacités & Dons"
const SPELLS_TAB_ID = 'tab-spells';     // L'onglet "Sorts"
// --- FIN CONFIGURATION ---

// Variables nécessaires aux calculs
const skillMap = {
    'acro': 'dex', 'arca': 'int', 'ath': 'force', 'disc': 'dex',
    'dres': 'sag', 'esca': 'dex', 'hist': 'int', 'inti': 'cha',
    'inve': 'int', 'med': 'sag', 'nat': 'int', 'perc': 'sag',
    'persp':'sag', 'persu':'cha', 'rel': 'int', 'rep': 'cha',
    'sup': 'cha', 'sur': 'sag'
};
const stats = ['force', 'dex', 'con', 'int', 'sag', 'cha'];


// --- MATHS & CALCULS AUTOMATIQUES (GLOBAL) ---

function getMod(score) { return Math.floor((score - 10) / 2); }
function formatBonus(val) { return (val >= 0 ? '+' : '') + val; }

window.updateCalculations = function() {
    const profBonusEl = document.getElementById('bonus_maitrise');
    const profBonus = parseInt(profBonusEl ? profBonusEl.value : 0) || 0;

    stats.forEach(stat => {
        const valInput = document.getElementById('val_' + stat);
        if(!valInput) return; 

        const score = parseInt(valInput.value) || 10;
        const mod = getMod(score);
        
        const modSpan = document.getElementById('mod_' + stat);
        if(modSpan) modSpan.textContent = formatBonus(mod);

        const saveCheck = document.getElementById('maitrise_' + stat);
        const saveInput = document.getElementById('sauv_' + stat);
        if(saveCheck && saveInput) {
            let saveVal = mod + (saveCheck.checked ? profBonus : 0);
            saveInput.value = saveVal; 
        }
    });

    for (const [skillCode, statCode] of Object.entries(skillMap)) {
        const valInput = document.getElementById('val_' + statCode);
        const score = parseInt(valInput ? valInput.value : 10) || 10;
        const mod = getMod(score);
        const skillCheck = document.getElementById('m_' + skillCode);
        const skillValInput = document.getElementById('v_' + skillCode);

        if (skillCheck && skillValInput) {
            let skillTotal = mod + (skillCheck.checked ? profBonus : 0);
            skillValInput.value = skillTotal;
        }
    }
    
    const percValInput = document.getElementById('v_perc');
    const passPercInput = document.getElementById('perception_passive');

    if (percValInput && passPercInput) {
        const percVal = parseInt(percValInput.value) || 0;
        passPercInput.value = 10 + percVal;
    }
}


// --- GESTION DES CARTES (CAPACITÉS & SORTS) ---

/**
 * Ajuste la hauteur de la zone de texte pour s'adapter au contenu.
 */
window.autoResizeTextarea = function(el) {
    if (el.offsetParent === null) {
        // L'élément est masqué (onglet inactif). On ne peut pas calculer scrollHeight.
        return; 
    }

    el.style.height = 'auto'; 
    el.style.height = (el.scrollHeight) + 'px'; 
    
    const content = el.closest('.ability-content');
    if (content && content.style.maxHeight && content.style.maxHeight !== '0px') {
        setTimeout(() => {
            content.style.maxHeight = content.scrollHeight + 'px';
        }, 0); 
    }
};

// Fonction de bascule (toggle) pour ouvrir/fermer la carte
window.toggleCollapse = function(headerElement) {
    const card = headerElement.closest('.ability-card');
    const content = card.querySelector('.ability-content');
    
    card.classList.toggle('collapsed');
    
    if (content.style.maxHeight && content.style.maxHeight !== '0px') {
        content.style.maxHeight = '0px';
    } else {
        content.style.maxHeight = content.scrollHeight + "px";
        
        // Redimensionne la textarea si la carte s'ouvre
        const textarea = content.querySelector('.ability-desc');
        if (textarea) window.autoResizeTextarea(textarea);
    }
}

/**
 * Fonction centralisée pour redimensionner toutes les cartes.
 * Appelé lors du chargement ou du changement d'onglet.
 */
window.resizeAllCards = function() {
    document.querySelectorAll(`#${ABILITIES_TAB_ID} .ability-card, #${SPELLS_TAB_ID} .ability-card`).forEach(card => {
        const descEl = card.querySelector('.ability-desc');
        const content = card.querySelector('.ability-content');
        
        if (descEl) {
            window.autoResizeTextarea(descEl);
        }

        if (content && !card.classList.contains('collapsed')) {
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    });
}


window.addAbilityCard = function(data = {}) {
    const container = document.getElementById('abilities-container');
    if (!container) return;
    
    const card = document.createElement('div');
    
    const isCollapsed = data.collapsed !== false; 
    card.className = isCollapsed ? 'ability-card collapsed' : 'ability-card';
    
    // FIX LARGEUR: Nom 64%, Source 20%
    card.innerHTML = `
        <button class="remove-btn" onclick="this.closest('.ability-card').remove();">X</button>
        <div class="ability-header" onclick="toggleCollapse(this)">
            <input type="text" class="ability-name" placeholder="Nom de la capacité" value="${data.name || ''}" onclick="event.stopPropagation()" style="width: 64%;">
            <input type="text" class="ability-source" placeholder="(Source)" value="${data.source || ''}" onclick="event.stopPropagation()" style="width: 20%;">
            <i class="fas fa-chevron-down collapse-icon"></i>
        </div>
        <div class="ability-content">
            <textarea class="ability-desc" placeholder="Description de l'effet..." oninput="autoResizeTextarea(this)">${data.desc || ''}</textarea>
        </div>
    `;
    container.appendChild(card);
    
    // Redimensionnement immédiat
    setTimeout(window.resizeAllCards, 10);
}

// Fonction de création de carte de Sort
window.addSpellCard = function(data = {}) {
    const container = document.getElementById('spells-container');
    if (!container) return;

    const card = document.createElement('div');
    
    const isCollapsed = data.collapsed !== false; 
    card.className = isCollapsed ? 'ability-card collapsed' : 'ability-card';
    
    // FIX LARGEUR: Nom 64%, Niveau 10%
    card.innerHTML = `
        <button class="remove-btn" onclick="this.closest('.ability-card').remove();">X</button>
        <div class="ability-header" onclick="toggleCollapse(this)">
            <input type="text" class="ability-name" placeholder="Nom du Sort" value="${data.name || ''}" onclick="event.stopPropagation()" style="width: 64%;">
            <input type="number" class="ability-source" placeholder="Niv." value="${data.level || ''}" style="width: 10%;" onclick="event.stopPropagation()">
            <i class="fas fa-chevron-down collapse-icon"></i>
        </div>
        <div class="ability-content">
            <textarea class="ability-desc" placeholder="Portée, Composantes, Effet..." oninput="autoResizeTextarea(this)">${data.desc || ''}</textarea>
            <div style="font-size: 0.8em; margin-top: 5px;">
                <label>Slots:</label>
                <input type="number" class="spell-slots-max" placeholder="Max" value="${data.slotsMax || ''}" style="width: 30%;">
                <input type="number" class="spell-slots-used" placeholder="Utilisés" value="${data.slotsUsed || ''}" style="width: 30%;">
            </div>
        </div>
    `;
    container.appendChild(card);
    
    // Redimensionnement immédiat
    setTimeout(window.resizeAllCards, 10);
}


// --- FIREBASE : SAUVEGARDE & CHARGEMENT (FONCTIONS GLOBALES) ---

window.saveData = async function() {
    const charIdInput = document.getElementById('char_id');
    const charId = charIdInput.value.trim();

    if (!charId) {
        alert("Veuillez entrer un ID de personnage (Ex: Thorin-01) pour sauvegarder.");
        charIdInput.focus();
        return;
    }

    const data = {};
    allInputs.forEach(el => {
        if (el.id) {
            data[el.id] = (el.type === 'checkbox') ? el.checked : el.value;
        }
    });

    // Sauvegarde des Capacités
    const abilityCards = document.querySelectorAll('#abilities-container .ability-card');
    const abilitiesList = [];
    abilityCards.forEach(card => {
        abilitiesList.push({
            name: card.querySelector('.ability-name').value,
            source: card.querySelector('.ability-source').value,
            desc: card.querySelector('.ability-desc').value,
            collapsed: card.classList.contains('collapsed') 
        });
    });
    data.abilities_list = abilitiesList; 

    // Sauvegarde des Sorts
    const spellCards = document.querySelectorAll('#spells-container .ability-card');
    const spellsList = [];
    spellCards.forEach(card => {
        spellsList.push({
            name: card.querySelector('.ability-name').value,
            level: card.querySelector('.ability-source').value,
            desc: card.querySelector('.ability-desc').value,
            slotsMax: card.querySelector('.spell-slots-max').value,
            slotsUsed: card.querySelector('.spell-slots-used').value,
            collapsed: card.classList.contains('collapsed') 
        });
    });
    data.spells_list = spellsList; 

    try {
        const charRef = doc(db, COLLECTION_NAME, charId);
        await setDoc(charRef, data);
        alert(`Fiche "${charId}" sauvegardée sur Firebase !`);
    } catch (e) {
        console.error("Erreur lors de la sauvegarde : ", e);
        alert("Erreur de sauvegarde. Vérifiez la console.");
    }
}

window.loadData = async function() {
    const charIdInput = document.getElementById('char_id');
    const charId = charIdInput.value.trim();

    if (!charId) {
        alert("Veuillez entrer l'ID du personnage à charger.");
        charIdInput.focus();
        return;
    }

    try {
        const charRef = doc(db, COLLECTION_NAME, charId);
        const docSnap = await getDoc(charRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Charger les inputs simples
            allInputs.forEach(el => {
                if (el.id && data[el.id] !== undefined) {
                    if (el.type === 'checkbox') el.checked = data[el.id];
                    else el.value = data[el.id];
                }
            });

            // Chargement des Capacités
            const abilityContainer = document.getElementById('abilities-container');
            if (abilityContainer) {
                abilityContainer.innerHTML = ''; 
                if (data.abilities_list && Array.isArray(data.abilities_list)) {
                    data.abilities_list.forEach(ability => {
                        window.addAbilityCard(ability); 
                    });
                }
            }

            // Chargement des Sorts
            const spellContainer = document.getElementById('spells-container');
            if (spellContainer) {
                spellContainer.innerHTML = ''; 
                if (data.spells_list && Array.isArray(data.spells_list)) {
                    data.spells_list.forEach(spell => {
                        window.addSpellCard(spell); 
                    });
                }
            }

            window.updateCalculations(); 
            
            // Redimensionnement immédiat si on est sur un des onglets dynamiques
            if (document.getElementById(ABILITIES_TAB_ID)?.classList.contains('active') ||
                document.getElementById(SPELLS_TAB_ID)?.classList.contains('active')) {
                window.resizeAllCards(); 
            }

            alert(`Fiche "${charId}" chargée avec succès !`);
        } else {
            alert(`Aucune fiche trouvée avec l'ID: ${charId}`);
        }
    } catch (e) {
        console.error("Erreur lors du chargement : ", e);
        alert("Erreur de chargement. Vérifiez la console.");
    }
}


// --- SYSTÈME DE DÉS (Modale) ---

window.rollStat = function(statName) {
    const valInput = document.getElementById('val_' + statName);
    const score = parseInt(valInput.value) || 10;
    const mod = getMod(score);
    const names = {
        'force': 'Force', 'dex': 'Dextérité', 'con': 'Constitution',
        'int': 'Intelligence', 'sag': 'Sagesse', 'cha': 'Charisme'
    };
    launchModal("Test de " + (names[statName] || statName), mod);
}

window.rollSimple = function(title, inputId) {
    const valInput = document.getElementById(inputId);
    const bonus = parseInt(valInput.value) || 0; 
    launchModal(title, bonus);
}

function launchModal(title, mod) {
    const dieRoll = Math.floor(Math.random() * 20) + 1;
    const total = dieRoll + mod;

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('valDie').textContent = dieRoll;
    document.getElementById('valMod').textContent = (mod >= 0 ? '+' : '') + mod;
    document.getElementById('valTotal').textContent = total;

    const critMsg = document.getElementById('critMessage');
    const totalBox = document.getElementById('valTotal');
    critMsg.className = 'crit-msg'; 
    critMsg.textContent = '';
    totalBox.style.color = 'inherit'; 

    if (dieRoll === 20) {
        critMsg.textContent = "RÉUSSITE CRITIQUE !";
        critMsg.classList.add('crit-success');
        totalBox.style.color = '#e0af68'; 
    } else if (dieRoll === 1) {
        critMsg.textContent = "ÉCHEC CRITIQUE !";
        critMsg.classList.add('crit-fail');
        totalBox.style.color = '#f7768e'; 
    }

    document.getElementById('diceModal').style.display = 'flex';
}

window.closeModal = function() {
    document.getElementById('diceModal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('diceModal');
    if (event.target == modal) modal.style.display = "none";
}

// Navigation Onglets
window.openTab = function(id, btn) {
    // Désactive tous les onglets et boutons
    document.querySelectorAll('.tab-content').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // Active le nouvel onglet et le bouton
    const tabContent = document.getElementById(id);
    if(tabContent) tabContent.classList.add('active');
    if(btn) btn.classList.add('active'); 

    // FIX PRINCIPAL : Si l'un des onglets dynamiques est ouvert, on force le redimensionnement.
    if (id === ABILITIES_TAB_ID || id === SPELLS_TAB_ID) {
        // Le délai est nécessaire pour que scrollHeight soit calculable après que l'élément soit affiché
        setTimeout(window.resizeAllCards, 10);
    }
}


// --- DOM CONTENT LOADED (ÉCOUTEURS ET INITIALISATION) ---

document.addEventListener('DOMContentLoaded', () => {
    
    allInputs = document.querySelectorAll('input, textarea');

    // Événements d'entrée pour les calculs automatiques
    document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.type === 'checkbox') {
            if (e.target.id === 'bonus_maitrise' || e.target.id.startsWith('val_') || 
                e.target.id.startsWith('maitrise_') || e.target.id.startsWith('m_')) {
                window.updateCalculations();
            }
        }
    });

    // Événement pour le bouton Reset
    const resetBtn = document.getElementById('resetBtn');
    if(resetBtn) {
        resetBtn.addEventListener('click', () => {
            if(confirm("Attention : Voulez-vous vraiment effacer la fiche locale actuelle ?")) {
                allInputs.forEach(el => {
                    if (el.type === 'checkbox') el.checked = false;
                    else el.value = '';
                });
                // Valeurs par défaut
                stats.forEach(s => {
                    const input = document.getElementById('val_' + s);
                    if(input) input.value = 10;
                });
                document.getElementById('niveau').value = 1;
                document.getElementById('bonus_maitrise').value = 2;
                
                // Effacer les listes dynamiques
                const abilityContainer = document.getElementById('abilities-container');
                if(abilityContainer) abilityContainer.innerHTML = '';
                const spellContainer = document.getElementById('spells-container');
                if(spellContainer) spellContainer.innerHTML = '';

                window.updateCalculations();
            }
        });
    }

    // Gestion de l'ajout de cartes
    const addAbilityBtn = document.getElementById('addAbilityBtn');
    if (addAbilityBtn) {
        addAbilityBtn.addEventListener('click', () => {
            window.addAbilityCard();
        });
    }

    const addSpellBtn = document.getElementById('addSpellBtn');
    if (addSpellBtn) {
        addSpellBtn.addEventListener('click', () => {
            window.addSpellCard();
        });
    }

    window.updateCalculations(); 
});
