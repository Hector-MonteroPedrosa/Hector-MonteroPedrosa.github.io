export class UIManager {
    constructor(sceneManager, onAddPrimitive, onAddModifier) {
        this.sceneManager = sceneManager;
        this.onAddPrimitive = onAddPrimitive;
        this.onAddModifier = onAddModifier;

        this.initListeners();
    }

    initListeners() {
        // Menu de añadir objetos
        const addBtn = document.getElementById('add-btn');
        const dropdown = document.getElementById('add-dropdown');

        addBtn.addEventListener('click', () => dropdown.classList.toggle('hidden'));

        dropdown.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                this.onAddPrimitive(type);
                dropdown.classList.add('hidden');
            });
        });

        // Selector de modificadores
        const modSelect = document.getElementById('add-modifier-select');
        modSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                this.onAddModifier(e.target.value);
                e.target.value = '';
            }
        });
    }

    updateOutliner() {
        const list = document.getElementById('scene-tree');
        list.innerHTML = '';
        
        this.sceneManager.objects.forEach(obj => {
            const li = document.createElement('li');
            li.textContent = obj.name;
            li.style.cursor = 'pointer';
            if (this.sceneManager.selectedObject === obj) {
                li.style.color = '#e28526';
            }
            li.addEventListener('click', () => {
                this.sceneManager.select(obj);
                this.updateOutliner();
            });
            list.appendChild(li);
        });
    }
}