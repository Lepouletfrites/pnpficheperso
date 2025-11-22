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

/** Fonction principale de mise à jour de tous les calculs automatiques */
window.updateCalculations = function() {
    const profBonusEl = document.getElementById('bonus_maitrise');
    const profBonus = parseInt(profBonusEl ? profBonusEl.value : 0) || 0;

    // 1. Calcul des Modificateurs et des Jets de Sauvegarde
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
    
    const modForce = getStatMod('force');
    const modDex = getStatMod('dex');

    // Mod CàC : Affiche le Mod FOR seul
    const attaqueCac = modForce; 
    const cacInput = document.getElementById('atk_cac');
    if (cacInput) cacInput.value = formatBonus(attaqueCac);

    // Mod Dist. : Affiche le Mod DEX seul
    const attaqueDistance = modDex;
    const distInput = document.getElementById('atk_dist');
    if (distInput) distInput.value = formatBonus(attaqueDistance);

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

    // --- FIN CALCULS DE COMBAT AUTOMATIQUES ---


    // 2. Calcul des Compétences
    for (const [skillCode, statCode] of Object.entries(skillMap)) {
        const mod = getStatMod(statCode); 
        const skillCheck = document.getElementById('m_' + skillCode);
        const skillValInput = document.getElementById('v_' + skillCode);

        if (skillCheck && skillValInput) {
            // Compétence = Mod Stat + (Maîtrise si cochée)
            let skillTotal = mod + (skillCheck.checked ? profBonus : 0);
            skillValInput.value = skillTotal;
        }
    }
    
    // 3. Calcul de la Perception Passive
    const percValInput = document.getElementById('v_perc');
    const passPercInput = document.getElementById('perception_passive');

    if (percValInput && passPercInput) {
        const percVal = parseInt(percValInput.value) || 0;
        // Perception Passive = 10 + Mod. Perception (qui est v_perc)
        passPercInput.value = 10 + percVal;
    }
}


// --- GESTION DES CARTES DYNAMIQUES (CAPACITÉS & SORTS) ---

/** Redimensionne automatiquement le textarea */
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

/** Ouvre/Ferme une carte de capacité/sort */
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

/** Recalcule la hauteur de toutes les cartes ouvertes */
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

/** Ajoute une nouvelle carte de Capacité */
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

/** Ajoute une nouvelle carte de Sort */
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


// --- FIREBASE : SAUVEGARDE & CHARGEMENT ---

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

// Navigation Onglets
window.openTab = function(id, btn) {
    // Désactive tous les onglets et boutons
    document.querySelectorAll('.tab-content').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // Active le nouvel onglet et le bouton
    const tabContent = document.getElementById(id);
    if(tabContent) tabContent.classList.add('active');
    if(btn) btn.classList.add('active'); 

    // Si l'un des onglets dynamiques est ouvert, on force le redimensionnement.
    if (id === ABILITIES_TAB_ID || id === SPELLS_TAB_ID) {
        setTimeout(window.resizeAllCards, 10);
    }
}


// --- DOM CONTENT LOADED (ÉCOUTEURS ET INITIALISATION) ---

document.addEventListener('DOMContentLoaded', () => {
    
    // Sélection de tous les inputs une seule fois au chargement
    allInputs = document.querySelectorAll('input, textarea');

    // Événements d'entrée pour les calculs automatiques
    document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.type === 'checkbox') {
            // Déclenche un recalcul si on modifie une stat, le bonus de maîtrise, ou un check de maîtrise
            if (e.target.id === 'bonus_maitrise' || e.target.id.startsWith('val_') || 
                e.target.id.startsWith('maitrise_') || e.target.id.startsWith('m_')) {
                window.updateCalculations();
            }
            // Déclenche un recalcul si la stat magique est modifiée
            if (e.target.id === 'stat_magie_id') {
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
                    if (el.id !== 'char_id' && !el.readOnly) {
                        el.value = '';
                    }
                });
                // Valeurs par défaut des stats
                stats.forEach(s => {
                    const input = document.getElementById('val_' + s);
                    if(input) input.value = 10;
                });
                document.getElementById('niveau').value = 1;
                document.getElementById('bonus_maitrise').value = 2;
                const magieStatInput = document.getElementById('stat_magie_id');
                if (magieStatInput) magieStatInput.value = 'int';
                
                // Effacer les listes dynamiques
                const abilityContainer = document.getElementById('abilities-container');
                if(abilityContainer) abilityContainer.innerHTML = '';
                const spellContainer = document.getElementById('spells-container');
                if(spellContainer) spellContainer.innerHTML = '';

                window.updateCalculations();
            }
        });
    }

    // Gestion de l'ajout de cartes (Capacités & Sorts)
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

    // Lancement des premiers calculs au démarrage
    window.updateCalculations(); 
});
