// On importe les fonctions nécessaires de Firebase Firestore
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";

// Initialisation de Firestore
const app = getApp();
const db = getFirestore(app);
const COLLECTION_NAME = 'characters'; 

let allInputs; 

// Constantes pour les IDs d'onglets
const ABILITIES_TAB_ID = 'tab-abilities';
const SPELLS_TAB_ID = 'tab-spells';

// Mappage des compétences vers leur statistique associée
const skillMap = {
    'acro': 'dex', 'arca': 'int', 'ath': 'force', 'disc': 'dex',
    'dres': 'sag', 'esca': 'dex', 'hist': 'int', 'inti': 'cha',
    'inve': 'int', 'med': 'sag', 'nat': 'int', 'perc': 'sag',
    'persp':'sag', 'persu':'cha', 'rel': 'int', 'rep': 'cha',
    'sup': 'cha', 'sur': 'sag'
};
const stats = ['force', 'dex', 'con', 'int', 'sag', 'cha'];


// --- MATHS & CALCULS AUTOMATIQUES (GLOBAL) ---

/** Calcule le modificateur de caractéristique */
function getMod(score) { return Math.floor((score - 10) / 2); }
/** Formate le bonus avec un signe + si positif */
function formatBonus(val) { return (val >= 0 ? '+' : '') + val; }

/** Récupère le modificateur d'une stat à partir de son ID (ex: 'force') */
function getStatMod(statCode) {
    const valInput = document.getElementById('val_' + statCode);
    const score = parseInt(valInput ? valInput.value : 10) || 10;
    return getMod(score);
}

/** Calcule le Bonus de Maîtrise en fonction du Niveau (Règles 5e) */
function calculateProficiencyBonus(level) {
    if (level >= 1 && level <= 4) return 2;
    if (level >= 5 && level <= 8) return 3;
    if (level >= 9 && level <= 12) return 4;
    if (level >= 13 && level <= 16) return 5;
    if (level >= 17 && level <= 20) return 6;
    return 2; // Niveau 0 ou niveau > 20 par défaut (peut être ajusté)
}


/** Fonction principale de mise à jour de tous les calculs automatiques */
window.updateCalculations = function() {
    // 1. Calcul automatique du Bonus de Maîtrise
    const niveauInput = document.getElementById('niveau');
    const niveau = parseInt(niveauInput ? niveauInput.value : 1) || 1;
    
    const profBonus = calculateProficiencyBonus(niveau);
    
    // Met à jour l'input readonly du Bonus de Maîtrise
    const profBonusEl = document.getElementById('bonus_maitrise');
    if (profBonusEl) profBonusEl.value = profBonus;


    // 2. Calcul des Modificateurs et des Jets de Sauvegarde
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
            // Jet de Sauvegarde = Mod + (Maîtrise si cochée)
            let saveVal = mod + (saveCheck.checked ? profBonus : 0);
            saveInput.value = saveVal; 
        }
    });

    // --- CALCULS DE COMBAT DE BASE ---
    
    // Mod CàC : Affiche le Mod FOR seul
    const modForce = getStatMod('force');
    const cacInput = document.getElementById('atk_cac');
    if (cacInput) cacInput.value = formatBonus(modForce);

    // Mod Dist. : Affiche le Mod DEX seul
    const modDex = getStatMod('dex');
    const distInput = document.getElementById('atk_dist');
    if (distInput) distInput.value = formatBonus(modDex);

    // Statistiques Magiques
    const statMagieId = document.getElementById('stat_magie_id')?.value.toLowerCase() || 'int'; 
    const modMagie = getStatMod(statMagieId);
    
    // Attaque Magique = Mod Magie + Maîtrise
    const attaqueMagique = modMagie + profBonus; 
    const atkMagInputCombat = document.getElementById('atk_mag');
    if (atkMagInputCombat) atkMagInputCombat.value = formatBonus(attaqueMagique);

    // DD Sorts = 8 + Mod Magie + Maîtrise
    const ddSauvegarde = 8 + modMagie + profBonus;
    const ddInput = document.getElementById('magic_dd');
    if (ddInput) ddInput.value = ddSauvegarde;
    const atkMagInputSpells = document.getElementById('magic_atk');
    if (atkMagInputSpells) atkMagInputSpells.value = formatBonus(attaqueMagique);

    // --- CALCULS DES ARMES INDIVIDUELLES ---
    for (let i = 1; i <= 4; i++) {
        const statInput = document.getElementById(`w${i}_stat`);
        const masteryCheck = document.getElementById(`w${i}_maitrise`);
        const atkInput = document.getElementById(`w${i}_atk`);
        
        if (!statInput || !atkInput) continue;

        const statCode = statInput.value.toLowerCase().trim();
        const mastery = masteryCheck?.checked || false;

        let mod = 0;
        // Détermination du Modificateur de Caractéristique
        if (statCode === 'for' || statCode === 'force') mod = getStatMod('force');
        else if (statCode === 'dex' || statCode === 'dextérité') mod = getStatMod('dex');
        else if (statCode === 'con' || statCode === 'constitution') mod = getStatMod('con');
        else if (statCode === 'int' || statCode === 'intelligence') mod = getStatMod('int');
        else if (statCode === 'sag' || statCode === 'sagesse') mod = getStatMod('sag');
        else if (statCode === 'cha' || statCode === 'charisme') mod = getStatMod('cha');

        // Bonus d'Attaque Total = Mod de Carac + (Bonus de Maîtrise si cochée)
        const totalAttackBonus = mod + (mastery ? profBonus : 0);
        atkInput.value = formatBonus(totalAttackBonus);
    }
    // --- FIN CALCULS DE COMBAT AUTOMATIQUES ---


    // 3. Calcul des Compétences
    for (const [skillCode, statCode] of Object.entries(skillMap)) {
        const mod = getStatMod(statCode); 
        const skillCheck = document.getElementById('m_' + skillCode);
        const skillValInput = document.getElementById('v_' + skillCode);

        if (skillCheck && skillValInput) {
            let skillTotal = mod + (skillCheck.checked ? profBonus : 0);
            skillValInput.value = skillTotal;
        }
    }
    
    // 4. Calcul de la Perception Passive
    const percValInput = document.getElementById('v_perc');
    const passPercInput = document.getElementById('perception_passive');

    if (percValInput && passPercInput) {
        const percVal = parseInt(percValInput.value) || 0;
        passPercInput.value = 10 + percVal;
    }
}


// --- GESTION DES CARTES DYNAMIQUES (CAPACITÉS & SORTS - INCHANGÉ) ---
// ... (Fonctions inchangées : autoResizeTextarea, toggleCollapse, resizeAllCards, addAbilityCard, addSpellCard) ...

window.autoResizeTextarea = function(el) {
    if (el.offsetParent === null) return; 
    el.style.height = 'auto'; 
    el.style.height = (el.scrollHeight) + 'px'; 
    
    const content = el.closest('.ability-content');
    if (content && content.style.maxHeight && content.style.maxHeight !== '0px') {
        setTimeout(() => {
            content.style.maxHeight = content.scrollHeight + 'px';
        }, 0); 
    }
};

window.toggleCollapse = function(headerElement) {
    const card = headerElement.closest('.ability-card');
    const content = card.querySelector('.ability-content');
    
    card.classList.toggle('collapsed');
    
    if (content.style.maxHeight && content.style.maxHeight !== '0px') {
        content.style.maxHeight = '0px';
    } else {
        content.style.maxHeight = content.scrollHeight + "px";
        const textarea = content.querySelector('.ability-desc');
        if (textarea) window.autoResizeTextarea(textarea);
    }
}

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
    setTimeout(window.resizeAllCards, 10);
}

window.addSpellCard = function(data = {}) {
    const container = document.getElementById('spells-container');
    if (!container) return;

    const card = document.createElement('div');
    const isCollapsed = data.collapsed !== false; 
    card.className = isCollapsed ? 'ability-card collapsed' : 'ability-card';
    
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
    setTimeout(window.resizeAllCards, 10);
}


// --- FIREBASE : SAUVEGARDE & CHARGEMENT (INCHANGÉ) ---
// ... (Fonctions inchangées : saveData, loadData) ...

window.saveData = async function() {
    const charIdInput = document.getElementById('char_id');
    const charId = charIdInput.value.trim();

    if (!charId) {
        alert("Veuillez entrer un ID de personnage (Ex: Thorin-01) pour sauvegarder.");
        charIdInput.focus();
        return;
    }

    const data = {};
    // 1. Sauvegarde des inputs standards
    allInputs.forEach(el => {
        if (el.id) {
            data[el.id] = (el.type === 'checkbox') ? el.checked : el.value;
        }
    });

    // 2. Sauvegarde des Capacités dynamiques
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

    // 3. Sauvegarde des Sorts dynamiques
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
            
            // 1. Charger les inputs simples
            allInputs.forEach(el => {
                if (el.id && data[el.id] !== undefined) {
                    // On exclut les inputs calculés 'readonly'
                    if (el.type === 'checkbox') el.checked = data[el.id];
                    if (!el.readOnly) {
                        el.value = data[el.id];
                    }
                }
            });

            // 2. Charger les Capacités
            const abilityContainer = document.getElementById('abilities-container');
            if (abilityContainer) {
                abilityContainer.innerHTML = ''; 
                if (data.abilities_list && Array.isArray(data.abilities_list)) {
                    data.abilities_list.forEach(ability => {
                        window.addAbilityCard(ability); 
                    });
                }
            }

            // 3. Charger les Sorts
            const spellContainer = document.getElementById('spells-container');
            if (spellContainer) {
                spellContainer.innerHTML = ''; 
                if (data.spells_list && Array.isArray(data.spells_list)) {
                    data.spells_list.forEach(spell => {
                        window.addSpellCard(spell); 
                    });
                }
            }

            // 4. Recalculer après le chargement
            window.updateCalculations(); 
            window.resizeAllCards(); 

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

/** Lance un jet de dé pour une Statistique de base */
window.rollStat = function(statName) {
    const mod = getStatMod(statName);
    const names = {
        'force': 'Force', 'dex': 'Dextérité', 'con': 'Constitution',
        'int': 'Intelligence', 'sag': 'Sagesse', 'cha': 'Charisme'
    };
    launchModal("Test de " + (names[statName] || statName), mod);
}

/** Lance un jet de dé pour une valeur simple (Compétences, Jet de Sauvegarde) */
window.rollSimple = function(title, inputId) {
    const valInput = document.getElementById(inputId);
    const bonus = parseInt(valInput.value) || 0; 
    launchModal(title, bonus);
}

/** Lance un jet de dé pour une attaque d'arme */
window.rollWeaponAttack = function(index) {
    const nameInput = document.getElementById(`w${index}_nom`);
    const atkInput = document.getElementById(`w${index}_atk`);
    
    const weaponName = nameInput?.value.trim() || `Arme ${index}`;
    // Récupère le bonus d'attaque calculé dans l'input readonly
    const bonus = parseInt(atkInput?.value) || 0; 
    
    launchModal(`Attaque : ${weaponName}`, bonus);
}

function launchModal(title, mod) {
    const dieRoll = Math.floor(Math.random() * 20) + 1;
    const total = dieRoll + mod;

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('valDie').textContent = dieRoll;
    document.getElementById('valMod').textContent = formatBonus(mod);
    document.getElementById('valTotal').textContent = total;

    const critMsg = document.getElementById('critMessage');
    const totalBox = document.getElementById('valTotal');
    critMsg.className = 'crit-msg'; 
    critMsg.textContent = '';
    totalBox.style.color = 'inherit'; 

    if (dieRoll === 20) {
        critMsg.textContent = "RÉUSSITE CRITIQUE !";
        critMsg.classList.add('crit-success');
        totalBox.style.color = 'var(--color-gold)'; 
    } else if (dieRoll === 1) {
        critMsg.textContent = "ÉCHEC CRITIQUE !";
        critMsg.classList.add('crit-fail');
        totalBox.style.color = 'var(--color-red)'; 
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

// Navigation Onglets (INCHANGÉ)
window.openTab = function(id, btn) {
    document.querySelectorAll('.tab-content').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const tabContent = document.getElementById(id);
    if(tabContent) tabContent.classList.add('active');
    if(btn) btn.classList.add('active'); 

    if (id === ABILITIES_TAB_ID || id === SPELLS_TAB_ID) {
        setTimeout(window.resizeAllCards, 10);
    }
}


// --- DOM CONTENT LOADED (ÉCOUTEURS ET INITIALISATION) ---

document.addEventListener('DOMContentLoaded', () => {
    
    allInputs = document.querySelectorAll('input, textarea');

    // Événements d'entrée pour les calculs automatiques
    document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.type === 'checkbox') {
            
            // L'événement se déclenche si le Niveau, une Stat, une Maîtrise (Sauv/Comp) ou Stat Magique change
            if (e.target.id === 'niveau' || e.target.id === 'stat_magie_id' || e.target.id.startsWith('val_') || 
                e.target.id.startsWith('maitrise_') || e.target.id.startsWith('m_')) {
                window.updateCalculations();
            }
            
            // Check des inputs spécifiques aux armes (Stat et Maîtrise)
            if (e.target.id.endsWith('_stat') || e.target.id.endsWith('_maitrise')) {
                window.updateCalculations();
            }
        }
    });

    // ... (Le reste de l'initialisation est inchangé) ...
    const resetBtn = document.getElementById('resetBtn');
    if(resetBtn) {
        resetBtn.addEventListener('click', () => {
            if(confirm("Attention : Voulez-vous vraiment effacer la fiche locale actuelle ?")) {
                allInputs.forEach(el => {
                    if (el.type === 'checkbox') el.checked = false;
                    if (el.id !== 'char_id' && !el.readOnly) {
                        el.value = '';
                    }
                });
                stats.forEach(s => {
                    const input = document.getElementById('val_' + s);
                    if(input) input.value = 10;
                });
                document.getElementById('niveau').value = 1;
                // 'bonus_maitrise' n'a plus besoin d'être réinitialisé, car il est calculé
                const magieStatInput = document.getElementById('stat_magie_id');
                if (magieStatInput) magieStatInput.value = 'int';
                
                const abilityContainer = document.getElementById('abilities-container');
                if(abilityContainer) abilityContainer.innerHTML = '';
                const spellContainer = document.getElementById('spells-container');
                if(spellContainer) spellContainer.innerHTML = '';

                window.updateCalculations();
            }
        });
    }

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
