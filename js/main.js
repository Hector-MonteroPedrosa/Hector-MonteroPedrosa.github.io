import * as THREE from 'three';
import { SceneManager } from './scene.js';
import { EditModeManager } from './editMode.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('viewport-container');
    const sceneManager = new SceneManager(container);

    // Instanciar Edit Mode Manager
    const editModeManager = new EditModeManager(sceneManager);
    
    // Exponer globalmente para depuración rápida en consola
    window.sceneManager = sceneManager;
    window.editMode = editModeManager;

    // Crear cubo por defecto
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4 });
    const cube = new THREE.Mesh(geometry, material);
    cube.name = 'Cube';
    
    sceneManager.add(cube);

    // Bucle de renderizado
    function animate() {
        requestAnimationFrame(animate);
        editModeManager.update();
        sceneManager.render();
    }
    animate();
});