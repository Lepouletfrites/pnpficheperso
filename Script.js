// On importe les fonctions nécessaires de Firebase Firestore
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";

// Initialisation de Firestore à partir de l'application initialisée dans l'HTML
const app = getApp();
const db = getFirestore(app);
const COLLECTION_NAME = 'characters'; // Collection où les fiches seront stockées

document.addEventListener('DOMContentLoaded', () => {
    // La sauvegarde locale est désactivée au profit de Firebase, mais le code de calcul reste
    // const STORAGE_KEY = 'rnp_fiche_auto_v4';

    const skillMap = {
        'acro': 'dex', 'arca': 'int', 'ath': 'force', 'disc': 'dex',
        'dres': 'sag', 'esca': 'dex', 'hist': 'int', 'inti': 'cha',
        'inve': 'int', 'med': 'sag', 'nat': 'int', 'perc': 'sag',
        'persp':'sag', 'persu':'cha', 'rel': 'int', 'rep': 'cha',
        'sup': 'cha', 'sur': 'sag'
    };
    const stats = ['force', 'dex', 'con', 'int', 'sag', 'cha'];
    let allInputs = document.querySelectorAll('input, textarea');

    // --- MATHS & CALCULS AUTOMATIQUES (Inchangés) ---
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

    // --- FIREBASE : SAUVEGARDE & CHARGEMENT ---

    // Rendre les fonctions globales pour les boutons HTML
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
                allInputs.forEach(el => {
                    if (el.id && data[el.id] !== undefined) {
                        if (el.type === 'checkbox') el.checked = data[el.id];
                        else el.value = data[el.id];
                    }
                });
                
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


    // --- ÉCOUTEURS D'ÉVÉNEMENTS ---

    document.addEventListener('input', (e) => {
        // Le auto-save est retiré. L'utilisateur doit cliquer sur "Sauver".
        // On ne fait que mettre à jour les calculs en temps réel.
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            if (e.target.id === 'bonus_maitrise' || e.target.id.startsWith('val_') || 
                e.target.id.startsWith('maitrise_') || e.target.id.startsWith('m_')) {
                updateCalculations();
            }
        }
    });

    const resetBtn = document.getElementById('resetBtn');
    if(resetBtn) {
        resetBtn.addEventListener('click', () => {
            if(confirm("Attention : Voulez-vous vraiment effacer la fiche locale actuelle ?")) {
                allInputs.forEach(el => {
                    if (el.type === 'checkbox') el.checked = false;
                    else el.value = '';
                });
                document.getElementById('val_force').value = 10; // Remettre les stats de base
                document.getElementById('val_dex').value = 10;
                document.getElementById('val_con').value = 10;
                document.getElementById('val_int').value = 10;
                document.getElementById('val_sag').value = 10;
                document.getElementById('val_cha').value = 10;
                document.getElementById('niveau').value = 1;
                document.getElementById('bonus_maitrise').value = 2;

                updateCalculations();
            }
        });
    }

    // Calcul initial au démarrage (basé sur les valeurs par défaut)
    updateCalculations(); 
});


// --- SYSTÈME DE DÉS (Inchangé) ---
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
