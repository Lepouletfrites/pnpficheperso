// On importe les fonctions nécessaires de Firebase Firestore
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";

// Initialisation de Firestore à partir de l'application initialisée dans l'HTML
const app = getApp();
const db = getFirestore(app);
const COLLECTION_NAME = 'characters'; 

let allInputs; // Déclaration globale

document.addEventListener('DOMContentLoaded', () => {
    
    // Récupérer tous les inputs une fois le DOM chargé
    allInputs = document.querySelectorAll('input, textarea');

    const skillMap = {
        'acro': 'dex', 'arca': 'int', 'ath': 'force', 'disc': 'dex',
        'dres': 'sag', 'esca': 'dex', 'hist': 'int', 'inti': 'cha',
        'inve': 'int', 'med': 'sag', 'nat': 'int', 'perc': 'sag',
        'persp':'sag', 'persu':'cha', 'rel': 'int', 'rep': 'cha',
        'sup': 'cha', 'sur': 'sag'
    };
    const stats = ['force', 'dex', 'con', 'int', 'sag', 'cha'];

    // --- MATHS & CALCULS AUTOMATIQUES ---
    function getMod(score) { return Math.floor((score - 10) / 2); }
    function formatBonus(val) { return (val >= 0 ? '+' : '') + val; }

    function updateCalculations() {
        const profBonus = parseInt(document.getElementById('bonus_maitrise').value) || 0;

        stats.forEach(stat => {
            const valInput = document.getElementById('val_' + stat);
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
            const score = parseInt(valInput.value) || 10;
            const mod = getMod(score);
            const skillCheck = document.getElementById('m_' + skillCode);
            const skillValInput = document.getElementById('v_' + skillCode);

            if (skillCheck && skillValInput) {
                let skillTotal = mod + (skillCheck.checked ? profBonus : 0);
                skillValInput.value = skillTotal;
            }
        }
        
        const percVal = parseInt(document.getElementById('v_perc').value) || 0;
        const passPercInput = document.getElementById('perception_passive');
        if(passPercInput) passPercInput.value = 10 + percVal;
    }

    // --- ÉCOUTEURS D'ÉVÉNEMENTS ---
    
    // Calculs automatiques
    document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            if (e.target.id === 'bonus_maitrise' || e.target.id.startsWith('val_') || 
                e.target.id.startsWith('maitrise_') || e.target.id.startsWith('m_')) {
                updateCalculations();
            }
        }
    });

    // Reset du formulaire
    const resetBtn = document.getElementById('resetBtn');
    if(resetBtn) {
        resetBtn.addEventListener('click', () => {
            if(confirm("Attention : Voulez-vous vraiment effacer la fiche locale actuelle ?")) {
                allInputs.forEach(el => {
                    if (el.type === 'checkbox') el.checked = false;
                    else el.value = '';
                });
                // Valeurs par défaut des stats
                document.getElementById('val_force').value = 10;
                document.getElementById('val_dex').value = 10;
                document.getElementById('val_con').value = 10;
                document.getElementById('val_int').value = 10;
                document.getElementById('val_sag').value = 10;
                document.getElementById('val_cha').value = 10;
                document.getElementById('niveau').value = 1;
                document.getElementById('bonus_maitrise').value = 2;
                
                // Effacer les listes dynamiques
                document.getElementById('abilities-container').innerHTML = '';
                document.getElementById('spells-container').innerHTML = '';

                updateCalculations();
            }
        });
    }

    // Fix pour l'ajout de cartes (solution au problème mobile/module)
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

    updateCalculations(); 
});


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
    allInputs.forEach(el => {
        if (el.id) {
            data[el.id] = (el.type === 'checkbox') ? el.checked : el.value;
        }
    });

    // --- GESTION DES CAPACITÉS (LISTE DYNAMIQUE) ---
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

    // --- GESTION DES SORTS (LISTE DYNAMIQUE) ---
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

    // --- FIN GESTION SORTS/CAPACITÉS ---

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

            // --- GESTION DES CAPACITÉS (CHARGEMENT) ---
            const abilityContainer = document.getElementById('abilities-container');
            abilityContainer.innerHTML = ''; 
            if (data.abilities_list && Array.isArray(data.abilities_list)) {
                data.abilities_list.forEach(ability => {
                    addAbilityCard(ability);
                });
            }

            // --- GESTION DES SORTS (CHARGEMENT) ---
            const spellContainer = document.getElementById('spells-container');
            spellContainer.innerHTML = ''; 
            if (data.spells_list && Array.isArray(data.spells_list)) {
                data.spells_list.forEach(spell => {
                    addSpellCard(spell); 
                });
            }
            // --- FIN GESTION SORTS/CAPACITÉS ---

            updateCalculations();
            alert(`Fiche "${charId}" chargée avec succès !`);
        } else {
            alert(`Aucune fiche trouvée avec l'ID: ${charId}`);
        }
    } catch (e) {
        console.error("Erreur lors du chargement : ", e);
        alert("Erreur de chargement. Vérifiez la console.");
    }
}


// --- GESTION DES CAPACITÉS/SORTS (Fonctions d'ajout et suppression & COLLAPSE) ---

// Fonction de bascule (toggle) pour ouvrir/fermer la carte
window.toggleCollapse = function(headerElement) {
    const card = headerElement.closest('.ability-card');
    const content = card.querySelector('.ability-content');
    
    card.classList.toggle('collapsed');
    
    // Gérer le max-height pour l'animation CSS
    if (content.style.maxHeight && content.style.maxHeight !== '0px') {
        content.style.maxHeight = '0px';
    } else {
        content.style.maxHeight = content.scrollHeight + "px";
    }
}


window.addAbilityCard = function(data = {}) {
    const container = document.getElementById('abilities-container');
    
    const card = document.createElement('div');
    
    const isCollapsed = data.collapsed !== false; 
    card.className = isCollapsed ? 'ability-card collapsed' : 'ability-card';
    
    card.innerHTML = `
        <button class="remove-btn" onclick="this.closest('.ability-card').remove();">X</button>
        <div class="ability-header" onclick="toggleCollapse(this)">
            <input type="text" class="ability-name" placeholder="Nom de la capacité" value="${data.name || ''}" onclick="event.stopPropagation()">
            <input type="text" class="ability-source" placeholder="(Classe/Peuple)" value="${data.source || ''}" onclick="event.stopPropagation()">
            <i class="fas fa-chevron-down collapse-icon"></i>
        </div>
        <div class="ability-content">
            <textarea class="ability-desc" rows="3" placeholder="Description de l'effet...">${data.desc || ''}</textarea>
        </div>
    `;
    container.appendChild(card);
    
    if (!isCollapsed) {
        const content = card.querySelector('.ability-content');
        setTimeout(() => {
            content.style.maxHeight = content.scrollHeight + "px";
        }, 0);
    }
}

// Fonction de création de carte de Sort
window.addSpellCard = function(data = {}) {
    const container = document.getElementById('spells-container');
    
    const card = document.createElement('div');
    
    const isCollapsed = data.collapsed !== false; 
    card.className = isCollapsed ? 'ability-card collapsed' : 'ability-card';
    
    card.innerHTML = `
        <button class="remove-btn" onclick="this.closest('.ability-card').remove();">X</button>
        <div class="ability-header" onclick="toggleCollapse(this)">
            <input type="text" class="ability-name" placeholder="Nom du Sort" value="${data.name || ''}" onclick="event.stopPropagation()">
            <input type="number" class="ability-source" placeholder="Niv." value="${data.level || ''}" style="width: 20%;" onclick="event.stopPropagation()">
            <i class="fas fa-chevron-down collapse-icon"></i>
        </div>
        <div class="ability-content">
            <textarea class="ability-desc" rows="3" placeholder="Portée, Composantes, Effet...">${data.desc || ''}</textarea>
            <div style="font-size: 0.8em; margin-top: 5px;">
                <label>Slots:</label>
                <input type="number" class="spell-slots-max" placeholder="Max" value="${data.slotsMax || ''}" style="width: 30%;">
                <input type="number" class="spell-slots-used" placeholder="Utilisés" value="${data.slotsUsed || ''}" style="width: 30%;">
            </div>
        </div>
    `;
    container.appendChild(card);
    
    if (!isCollapsed) {
        const content = card.querySelector('.ability-content');
        setTimeout(() => {
            content.style.maxHeight = content.scrollHeight + "px";
        }, 0);
    }
}


// --- SYSTÈME DE DÉS (Modale) ---

window.rollStat = function(statName) {
    const valInput = document.getElementById('val_' + statName);
    const score = parseInt(valInput.value) || 10;
    const mod = Math.floor((score - 10) / 2);
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
    totalBox.style.color = '#9ece6a';

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
    document.querySelectorAll('.tab-content').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
}
